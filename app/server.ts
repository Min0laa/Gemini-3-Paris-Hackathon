/**
 * server.ts — REST API for the handoff pipeline
 *
 * Usage:
 *   npx tsx server.ts
 *
 * Routes:
 *   GET /analyze/:videoId   → run analysis (or return cached result)
 *   GET /outputs/*          → static file serving for frames
 *
 * Port 8080 (Next.js dev server uses 3000).
 *
 * Caching:
 *   If outputs/VIDEO_ID/handoff.json already exists, the analysis is skipped
 *   and the cached JSON is returned immediately (no re-download, no re-extraction).
 */

import express, { Request, Response } from "express";
import { join } from "path";
import { analyzeVideo } from "./handoff";

const PORT        = 8080;
const OUTPUTS_DIR = join(process.cwd(), "outputs");

const app = express();

// ─── Static files ─────────────────────────────────────────────────────────────
// Serves frame images at: GET /outputs/VIDEO_ID/spot_N/frame_a.jpg

app.use("/outputs", express.static(OUTPUTS_DIR));

// ─── Analysis route ───────────────────────────────────────────────────────────

app.get("/analyze/:videoId", async (req: Request, res: Response) => {
  const { videoId } = req.params;

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid video ID format." });
    return;
  }

  const baseUrl = `${req.protocol}://${req.get("host")}`;

  try {
    console.log(`[${new Date().toISOString()}] GET /analyze/${videoId}`);
    const result = await analyzeVideo(videoId, baseUrl);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  Error: ${message}`);
    res.status(422).json({ error: message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\nServer running → http://localhost:${PORT}`);
  console.log(`  GET http://localhost:${PORT}/analyze/:videoId\n`);
});
