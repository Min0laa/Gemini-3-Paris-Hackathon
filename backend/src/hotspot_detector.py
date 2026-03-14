"""
hotspot_detector.py
-------------------
Identifies "Hot Spots" in a YouTube video by cross-referencing
YouTube Studio retention data with visual scene-change detection.

Outputs a JSON manifest of the top N hot spots, each with:
  - timestamp
  - frame_a_path  (1 second before the scene cut)
  - frame_b_path  (exactly at the scene cut)

Usage (CLI):
    python hotspot_detector.py --video path/to/video.mp4 \
                                --retention path/to/retention.csv \
                                --output_dir frames/ \
                                --top_n 3

Usage (module):
    from hotspot_detector import detect_hotspots
    manifest = detect_hotspots(video_path, retention_path, output_dir)
"""

import argparse
import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import pandas as pd
from scipy.signal import find_peaks


# ─────────────────────────────────────────────
# Data models
# ─────────────────────────────────────────────

@dataclass
class HotSpot:
    spot_id: int
    timestamp_sec: float
    timestamp_str: str
    retention_value: float
    frame_a_path: str   # 1 second before transition
    frame_b_path: str   # exactly at the transition


# ─────────────────────────────────────────────
# 1. Retention analysis
# ─────────────────────────────────────────────

def load_retention(path: str) -> pd.DataFrame:
    """
    Load YouTube Studio retention export.

    Accepted formats
    ----------------
    CSV columns (any order):
        timestamp_sec | retention_percentage
        OR
        time | percentage

    JSON: list of { "timestamp_sec": float, "retention_percentage": float }
    """
    p = Path(path)
    if p.suffix.lower() == ".json":
        df = pd.read_json(path)
    else:
        df = pd.read_csv(path)

    # Normalise column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    rename = {}
    for col in df.columns:
        if col in ("time", "time_sec", "second", "seconds"):
            rename[col] = "timestamp_sec"
        if col in ("percentage", "retention", "audience_retention_%"):
            rename[col] = "retention_percentage"
    df = df.rename(columns=rename)

    required = {"timestamp_sec", "retention_percentage"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(
            f"Retention file is missing columns: {missing}. "
            f"Found: {list(df.columns)}"
        )

    df = df[["timestamp_sec", "retention_percentage"]].dropna().sort_values("timestamp_sec").reset_index(drop=True)
    return df


def find_retention_peaks(
    df: pd.DataFrame,
    top_n: int = 3,
    window_sec: float = 30.0,
) -> list[float]:
    """
    Return the timestamps (seconds) of the top-N retention peaks.

    Strategy
    --------
    1. Smooth the retention curve with a rolling average to reduce noise.
    2. Use scipy find_peaks to locate local maxima.
    3. Rank by retention value and return the top-N timestamps.
    4. Enforce a minimum spacing of `window_sec` between selected peaks
       so they are spread through the video.
    """
    signal = df["retention_percentage"].values.astype(float)
    times  = df["timestamp_sec"].values.astype(float)

    # Smooth (rolling window = ~10 data-points or 5 % of length)
    k = max(3, len(signal) // 20)
    smoothed = pd.Series(signal).rolling(k, center=True, min_periods=1).mean().values

    # Detect peaks — require some prominence so we skip micro-bumps
    prominence = max(1.0, np.ptp(smoothed) * 0.05)
    peaks, props = find_peaks(smoothed, prominence=prominence, distance=max(1, k))

    if len(peaks) == 0:
        # Fallback: evenly distribute across the middle 80 % of the video
        duration = float(times[-1])
        return [duration * f for f in [0.25, 0.50, 0.75]][:top_n]

    # Sort candidate peaks by retention value (descending)
    ranked = sorted(peaks, key=lambda i: smoothed[i], reverse=True)

    selected: list[float] = []
    for idx in ranked:
        t = float(times[idx])
        # Enforce minimum spacing between hot spots
        if all(abs(t - s) >= window_sec for s in selected):
            selected.append(t)
        if len(selected) == top_n:
            break

    # If we still don't have enough, pad with fallback timestamps
    if len(selected) < top_n:
        duration = float(times[-1])
        for frac in [0.25, 0.50, 0.75]:
            t = duration * frac
            if all(abs(t - s) >= window_sec for s in selected):
                selected.append(t)
            if len(selected) == top_n:
                break

    return sorted(selected)


# ─────────────────────────────────────────────
# 2. Scene-change detection
# ─────────────────────────────────────────────

def detect_scene_changes(
    video_path: str,
    threshold: float = 30.0,
) -> list[float]:
    """
    Detect scene cuts using frame-difference (HSV histogram diff).

    Returns a sorted list of timestamps (seconds) where cuts occur.
    threshold: mean absolute histogram difference that signals a cut.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise IOError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    cuts: list[float] = []
    prev_hist = None
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        hsv   = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        hist  = cv2.calcHist([hsv], [0, 1], None, [50, 60], [0, 180, 0, 256])
        cv2.normalize(hist, hist)

        if prev_hist is not None:
            diff = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_CHISQR)
            if diff > threshold:
                cuts.append(frame_idx / fps)

        prev_hist = hist
        frame_idx += 1

    cap.release()
    return cuts


def nearest_scene_cut(
    retention_peak_sec: float,
    scene_cuts: list[float],
    tolerance_sec: float = 5.0,
) -> Optional[float]:
    """
    Return the scene cut closest to `retention_peak_sec` within tolerance.
    Returns None if no cut is close enough.
    """
    if not scene_cuts:
        return None
    cuts = np.array(scene_cuts)
    diffs = np.abs(cuts - retention_peak_sec)
    idx = int(np.argmin(diffs))
    if diffs[idx] <= tolerance_sec:
        return float(cuts[idx])
    return None


# ─────────────────────────────────────────────
# 3. Frame extraction
# ─────────────────────────────────────────────

def extract_frame(
    video_path: str,
    timestamp_sec: float,
    output_path: str,
) -> str:
    """
    Save a single frame at `timestamp_sec` to `output_path`.
    Returns the output path.
    """
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_number = int(timestamp_sec * fps)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
    ret, frame = cap.read()
    cap.release()

    if not ret:
        raise RuntimeError(
            f"Could not read frame at {timestamp_sec:.2f}s "
            f"(frame #{frame_number}) from {video_path}"
        )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(output_path, frame)
    return output_path


def seconds_to_timestamp(sec: float) -> str:
    sec = max(0.0, sec)
    h   = int(sec // 3600)
    m   = int((sec % 3600) // 60)
    s   = int(sec % 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


# ─────────────────────────────────────────────
# 4. Main orchestrator
# ─────────────────────────────────────────────

def detect_hotspots(
    video_path: str,
    retention_path: str,
    output_dir: str = "frames",
    top_n: int = 3,
    scene_tolerance_sec: float = 5.0,
    scene_threshold: float = 30.0,
) -> list[dict]:
    """
    Full pipeline: retention peaks → nearest scene cut → frame extraction.

    Returns
    -------
    List of dicts matching the manifest schema:
        {
            "spot_id":      int,
            "timestamp":    "HH:MM:SS",
            "timestamp_sec": float,
            "retention":    float,
            "frame_a_path": str,   # 1 s before transition
            "frame_b_path": str,   # at the transition
        }
    """
    print(f"[1/4] Loading retention data from: {retention_path}")
    df = load_retention(retention_path)

    print(f"[2/4] Finding top-{top_n} retention peaks …")
    peak_times = find_retention_peaks(df, top_n=top_n * 2)  # oversample, filter below

    print(f"[3/4] Detecting scene changes in: {video_path}")
    scene_cuts = detect_scene_changes(video_path, threshold=scene_threshold)
    print(f"      → {len(scene_cuts)} scene cuts found")

    print(f"[4/4] Matching peaks to scene cuts and extracting frames …")
    manifest: list[dict] = []
    spot_id = 1

    for peak_t in peak_times:
        if len(manifest) == top_n:
            break

        cut_t = nearest_scene_cut(peak_t, scene_cuts, tolerance_sec=scene_tolerance_sec)

        # If no scene cut nearby, use the retention peak itself as the anchor
        anchor_t = cut_t if cut_t is not None else peak_t
        note     = "scene-cut" if cut_t is not None else "retention-peak (no nearby cut)"

        # Frame A: 1 second before the transition
        frame_a_sec  = max(0.0, anchor_t - 1.0)
        frame_a_path = os.path.join(output_dir, f"spot_{spot_id}_frame_a.jpg")

        # Frame B: exactly at the transition
        frame_b_path = os.path.join(output_dir, f"spot_{spot_id}_frame_b.jpg")

        try:
            extract_frame(video_path, frame_a_sec,  frame_a_path)
            extract_frame(video_path, anchor_t,     frame_b_path)
        except RuntimeError as e:
            print(f"      ⚠  Skipping spot at {seconds_to_timestamp(anchor_t)}: {e}")
            continue

        retention_val = float(
            df.loc[
                (df["timestamp_sec"] - peak_t).abs().idxmin(),
                "retention_percentage"
            ]
        )

        entry = {
            "spot_id":       spot_id,
            "timestamp":     seconds_to_timestamp(anchor_t),
            "timestamp_sec": round(anchor_t, 3),
            "retention":     round(retention_val, 2),
            "anchor_type":   note,
            "frame_a_path":  frame_a_path,
            "frame_b_path":  frame_b_path,
        }
        manifest.append(entry)
        print(
            f"      ✓ Spot {spot_id}: {entry['timestamp']} "
            f"(retention={retention_val:.1f}%, {note})"
        )
        spot_id += 1

    return manifest


# ─────────────────────────────────────────────
# 5. CLI entry point
# ─────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Detect YouTube video Hot Spots from retention data + scene cuts."
    )
    parser.add_argument("--video",      required=True, help="Path to the video file.")
    parser.add_argument("--retention",  required=True, help="Path to retention CSV or JSON.")
    parser.add_argument("--output_dir", default="frames", help="Directory to save extracted frames.")
    parser.add_argument("--top_n",      type=int,   default=3,    help="Number of hot spots to detect.")
    parser.add_argument("--tolerance",  type=float, default=5.0,  help="Max seconds between retention peak and scene cut.")
    parser.add_argument("--scene_threshold", type=float, default=30.0, help="Histogram diff threshold for scene detection.")
    parser.add_argument("--manifest",   default="hotspot_manifest.json", help="Output JSON manifest path.")
    args = parser.parse_args()

    manifest = detect_hotspots(
        video_path=args.video,
        retention_path=args.retention,
        output_dir=args.output_dir,
        top_n=args.top_n,
        scene_tolerance_sec=args.tolerance,
        scene_threshold=args.scene_threshold,
    )

    Path(args.manifest).parent.mkdir(parents=True, exist_ok=True)
    with open(args.manifest, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nManifest saved → {args.manifest}")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
