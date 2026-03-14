#!/bin/bash
# Start all services for local development.
# Requires: Python 3.8+, Node.js, ffmpeg, yt-dlp

set -e
cd "$(dirname "$0")/.."

echo ""
echo "Starting development services..."
echo ""
echo "  Handoff API (FastAPI) : http://localhost:8000"
echo "  Docs                  : http://localhost:8000/docs"
echo "  Extension dev build   : browser-extension/build/chrome-mv3-dev"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

# 1. FastAPI handoff server (app/main.py)
(cd app && uvicorn main:app --reload --port 8000) &
FASTAPI_PID=$!

# 2. Chrome Extension (Plasmo dev mode)
(cd browser-extension && npm run dev) &
PLASMO_PID=$!

trap "echo ''; echo 'Stopping...'; kill $FASTAPI_PID $PLASMO_PID 2>/dev/null; exit" INT TERM

wait
