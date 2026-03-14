import os
import shutil
import tempfile

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from hotspot_detector import detect_hotspots

app = FastAPI(title="HotSpot Detector API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
