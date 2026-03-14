# Gemini-3-Paris-Hackathon

AI-powered YouTube ad injection pipeline. Finds peak-energy moments in any YouTube video and generates a frame-accurate handoff package for AI ad rendering.

---

## Architecture

```
browser-extension/          Chrome Extension (Plasmo + React)
  contents/                   Injects UI into YouTube Studio upload flow
  assets/                     Static brand assets

app/                        Node.js / TypeScript engine
  src/lib/placement.ts        Scoring engine — finds injection points
  src/lib/gemini-service.ts   Gemini API bridge (mock → real)
  handoff.ts                  CLI + exportable analyzeVideo() function
  server.ts                   Express server (port 8080)
  main.py                     FastAPI server (port 8000) ← main backend
  outputs/                    Generated frames + handoff.json (gitignored)

backend/                    Separate video analysis service
  src/main.py                 FastAPI hotspot detector (file upload API)
```

---

## Prerequisites

- **Node.js 18+** and npm
- **Python 3.8+**
- **ffmpeg** + **yt-dlp** — `brew install ffmpeg yt-dlp`
- **FastAPI + uvicorn** — `pip install fastapi uvicorn`

---

## 1 — FastAPI Handoff Server

Serves injection spots and frame images to the Chrome Extension.

```bash
cd app
uvicorn main:app --reload --port 8000
```

| Route | Description |
|---|---|
| `GET /api/spots/{video_id}` | Analyze video or return cached result |
| `GET /outputs/{video_id}/spot_N/frame_a.jpg` | Extracted frame (static) |
| `GET /health` | Health check |
| `GET /docs` | Swagger UI |

**Example:**
```bash
curl http://localhost:8000/api/spots/dQw4w9WgXcQ
```

First call downloads + analyzes the video (~30s). Subsequent calls return instantly from cache (`app/outputs/VIDEO_ID/handoff.json`).

---

## 2 — Chrome Extension

Built with [Plasmo](https://docs.plasmo.com/). Injects an ad placement panel into the YouTube Studio upload flow.

### Install dependencies
```bash
cd browser-extension
npm install
```

### Dev mode (auto-reload)
```bash
npm run dev
```

### Load in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select `browser-extension/build/chrome-mv3-dev`

### How it connects to the API
When you open a YouTube video upload page, the extension reads the `v=VIDEO_ID` from the URL and calls:
```
GET http://localhost:8000/api/spots/{video_id}
```
The real injection timestamps replace the default fixed positions on the timeline.

---

## 3 — Run Everything at Once

```bash
./scripts/dev.sh
```

Starts the FastAPI server (port 8000) and the Plasmo dev watcher in parallel.

---

## 4 — CLI (no server needed)

```bash
cd app

# Analyze + extract frames
npx tsx handoff.ts VIDEO_ID

# Scores only (skip ffmpeg)
npx tsx run-local.ts VIDEO_ID --no-frames
```

Output is saved to `app/outputs/VIDEO_ID/`:
```
outputs/
└── VIDEO_ID/
    ├── handoff.json      ← clean JSON for teammates
    ├── spot_1/
    │   ├── frame_a.jpg   ← injection point frame
    │   └── frame_b.jpg   ← 5s later (visual reference)
    ├── spot_2/
    └── spot_3/
```

---

## handoff.json contract

```json
{
  "video_id": "string",
  "spots": [
    {
      "id": "spot_1",
      "timestamp_seconds": 256.223,
      "frame_a_time": 256.223,
      "frame_b_time": 256.323,
      "frame_a_path": "http://localhost:8000/outputs/VIDEO_ID/spot_1/frame_a.jpg",
      "frame_b_path": "http://localhost:8000/outputs/VIDEO_ID/spot_1/frame_b.jpg"
    }
  ]
}
```

`frame_a_time` → injection point (AI ad starts here)  
`frame_b_time` → `frame_a + 0.1s` (renderer contract)  
Paths are full URLs when served via the API, relative when read from disk.

---

## Gemini Integration (TODO)

`app/src/lib/gemini-service.ts` is currently mocked. To activate:
1. Add `GEMINI_API_KEY=your_key` to `app/.env`
2. Implement the TODO block in `gemini-service.ts`
