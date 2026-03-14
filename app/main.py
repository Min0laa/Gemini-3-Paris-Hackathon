"""
main.py — FastAPI server for the handoff pipeline

Usage:
    uvicorn main:app --reload --port 8000

Routes:
    GET /api/spots/{video_id}    -> analyze video (or return cached result)
    GET /outputs/{video_id}/...  -> static frame images

Caching:
    If outputs/{video_id}/handoff.json already exists, the TypeScript engine
    is skipped entirely and the JSON is returned immediately.

CORS:
    Allow-all origins — required for Chrome Extension access.
"""

import asyncio
import json
import re
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# --- Paths -------------------------------------------------------------------

APP_DIR     = Path(__file__).parent.resolve()
OUTPUTS_DIR = APP_DIR / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)

# --- App setup ---------------------------------------------------------------

app = FastAPI(title="Handoff API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     # Chrome Extension can call from any origin
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.mount("/outputs", StaticFiles(directory=OUTPUTS_DIR), name="outputs")

# --- Validation --------------------------------------------------------------

VALID_VIDEO_ID = re.compile(r"^[a-zA-Z0-9_-]{11}$")

# --- Helpers -----------------------------------------------------------------

def load_handoff(video_id: str) -> dict:
    """Read handoff.json from disk and return as dict."""
    path = OUTPUTS_DIR / video_id / "handoff.json"
    return json.loads(path.read_text())


def inject_urls(data: dict, base_url: str) -> dict:
    """
    Replace relative frame paths (./spot_N/frame_a.jpg) with full URLs.
    Called at response time — the file on disk stays relative.
    """
    video_id = data["video_id"]
    spots = [
        {
            **spot,
            "frame_a_path": f"{base_url}/outputs/{video_id}/{spot['id']}/frame_a.jpg",
            "frame_b_path": f"{base_url}/outputs/{video_id}/{spot['id']}/frame_b.jpg",
        }
        for spot in data["spots"]
    ]
    return {**data, "spots": spots}


async def run_ts_engine(video_id: str) -> None:
    """
    Invoke the TypeScript handoff engine as a subprocess.
    Raises HTTPException on non-zero exit.
    """
    proc = await asyncio.create_subprocess_exec(
        "npx", "tsx", "handoff.ts", video_id,
        cwd=APP_DIR,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        error_msg = stderr.decode(errors="replace").strip()
        raise HTTPException(
            status_code=422,
            detail=error_msg or "TypeScript analysis failed.",
        )


# --- Routes ------------------------------------------------------------------

@app.get("/api/spots/{video_id}")
async def get_spots(video_id: str, request: Request):
    if not VALID_VIDEO_ID.match(video_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid video ID — must be 11 alphanumeric characters.",
        )

    handoff_path = OUTPUTS_DIR / video_id / "handoff.json"
    base_url     = str(request.base_url).rstrip("/")

    # Cache hit — return immediately without running the engine
    if handoff_path.exists():
        return inject_urls(load_handoff(video_id), base_url)

    # Cache miss — run the TypeScript engine, then read the output
    await run_ts_engine(video_id)

    if not handoff_path.exists():
        raise HTTPException(status_code=404, detail="Analysis produced no output.")

    return inject_urls(load_handoff(video_id), base_url)


@app.get("/health")
async def health():
    return {"status": "ok"}
