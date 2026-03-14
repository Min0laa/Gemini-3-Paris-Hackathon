import json
import os
import re
import shutil
import subprocess
import tempfile

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from google import genai
from pydantic import BaseModel

from generate_ad import generate_ad
from hotspot_detector import detect_hotspots

app = FastAPI(title="HotSpot Detector API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VIDEO_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{11}$")

# Paths relative to this file
_SRC_DIR = os.path.dirname(os.path.abspath(__file__))
_SAMPLE_RETENTION = os.path.join(_SRC_DIR, "sample_retention.csv")
_OUTPUTS_DIR = os.path.join(_SRC_DIR, "outputs")
_IMAGES_DIR = os.path.join(_SRC_DIR, "images")


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {"status": "ok", "service": "hotspot-detector"}


# ── Analyze endpoint ──────────────────────────────────────────────────────────

class HotSpotEntry(BaseModel):
    spot_id: int
    timestamp: str
    timestamp_sec: float
    retention: float
    anchor_type: str
    frame_a_path: str
    frame_b_path: str


@app.post("/analyze", response_model=list[HotSpotEntry], summary="Detect Hot Spots")
async def analyze(
    video: UploadFile = File(..., description="Video file (mp4, mov, avi …)"),
    retention: UploadFile = File(..., description="YouTube retention CSV or JSON"),
    top_n: int = Query(default=3, ge=1, le=10, description="Number of hot spots to return"),
    tolerance: float = Query(default=5.0, description="Max seconds between retention peak and scene cut"),
    scene_threshold: float = Query(default=30.0, description="Histogram diff threshold for scene detection"),
):
    """
    Upload a video file and a YouTube Studio retention export.
    Returns the top-N hot spots with paths to the two extracted keyframes each.
    """
    tmp_dir = tempfile.mkdtemp(prefix="hotspot_")
    try:
        video_path     = os.path.join(tmp_dir, video.filename or "video.mp4")
        retention_path = os.path.join(tmp_dir, retention.filename or "retention.csv")
        frames_dir     = os.path.join(tmp_dir, "frames")

        with open(video_path, "wb") as f:
            shutil.copyfileobj(video.file, f)
        with open(retention_path, "wb") as f:
            shutil.copyfileobj(retention.file, f)

        manifest = detect_hotspots(
            video_path=video_path,
            retention_path=retention_path,
            output_dir=frames_dir,
            top_n=top_n,
            scene_tolerance_sec=tolerance,
            scene_threshold=scene_threshold,
        )

        return manifest

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # In production swap this for uploading frames to S3 before cleanup
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ── Hotspots by YouTube video ID ──────────────────────────────────────────────

@app.get("/hotspots/{video_id}", response_model=list[HotSpotEntry], summary="Detect Hot Spots from YouTube video")
async def hotspots_by_video_id(video_id: str):
    """
    Download a YouTube video by ID, run hotspot detection using the sample
    retention CSV, cache results, and return the manifest.
    """
    if not VIDEO_ID_RE.match(video_id):
        raise HTTPException(status_code=422, detail="Invalid video_id format")

    cache_dir = os.path.join(_OUTPUTS_DIR, video_id)
    manifest_path = os.path.join(cache_dir, "manifest.json")

    # Return cached result if available
    if os.path.isfile(manifest_path):
        with open(manifest_path, "r") as f:
            return json.load(f)

    # Download the video (persisted as a cache)
    video_path = f"/tmp/yt_{video_id}.mp4"
    if not os.path.isfile(video_path):
        result = subprocess.run(
            ["yt-dlp", "-f", "best[ext=mp4]", "-o", video_path, f"https://www.youtube.com/watch?v={video_id}"],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"yt-dlp failed: {result.stderr}")

    frames_dir = os.path.join(cache_dir, "frames")
    os.makedirs(frames_dir, exist_ok=True)

    try:
        manifest = detect_hotspots(
            video_path=video_path,
            retention_path=_SAMPLE_RETENTION,
            output_dir=frames_dir,
            top_n=3,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Serialize manifest entries to dicts with absolute frame paths for JSON storage
    def to_dict(entry):
        d = entry if isinstance(entry, dict) else entry.model_dump()
        d["frame_a_path"] = os.path.abspath(d["frame_a_path"])
        d["frame_b_path"] = os.path.abspath(d["frame_b_path"])
        return d

    manifest_data = [to_dict(entry) for entry in manifest]
    with open(manifest_path, "w") as f:
        json.dump(manifest_data, f, indent=2)

    return manifest_data


# ── Generate ad ───────────────────────────────────────────────────────────────

@app.get("/generate-ad", summary="Generate an ad video from a hotspot")
async def generate_ad_route(
    video_id: str = Query(..., description="YouTube video ID"),
    hotspot_id: int = Query(..., description="spot_id from /hotspots/{video_id}"),
    product_image_name: str = Query(..., description="Filename in backend/src/images/"),
    product_name: str = Query(..., description="Display name of the product"),
    script_part1: str = Query(..., description="Intro script"),
    script_part2: str = Query(..., description="Outro script"),
):
    if not VIDEO_ID_RE.match(video_id):
        raise HTTPException(status_code=422, detail="Invalid video_id format")

    manifest_path = os.path.join(_OUTPUTS_DIR, video_id, "manifest.json")
    if not os.path.isfile(manifest_path):
        raise HTTPException(status_code=404, detail="Run /hotspots/{video_id} first")

    with open(manifest_path, "r") as f:
        manifest_data = json.load(f)

    entry = next((e for e in manifest_data if e["spot_id"] == hotspot_id), None)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"hotspot_id {hotspot_id} not found in manifest")

    intro_path = entry["frame_a_path"]
    outro_path = entry["frame_b_path"]

    product_path = os.path.join(_IMAGES_DIR, product_image_name)
    if not os.path.isfile(product_path):
        raise HTTPException(status_code=404, detail=f"Product image '{product_image_name}' not found in images directory")

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY environment variable not set")
    client = genai.Client(api_key=api_key)
    try:
        output_video_path = generate_ad(
            client,
            intro_path,
            outro_path,
            product_path,
            product_name,
            script_part1,
            script_part2,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        client.close()

    return FileResponse(output_video_path, media_type="video/mp4")
