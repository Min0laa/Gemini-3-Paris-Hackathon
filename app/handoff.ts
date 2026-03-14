/**
 * handoff.ts — Clean technical output for teammate integration
 *
 * CLI usage:
 *   npx tsx handoff.ts <VIDEO_ID>
 *
 * Also imported by server.ts as `analyzeVideo(videoId, baseUrl?)`.
 *
 * Output:
 *   outputs/VIDEO_ID/
 *     handoff.json        — raw timestamps only, no AI/scoring data
 *     spot_N/frame_a.jpg  — injection point frame
 *     spot_N/frame_b.jpg  — 5s later (visual reference)
 *
 * Requires: yt-dlp + ffmpeg  (brew install yt-dlp ffmpeg)
 */

import { execFileSync, execFile } from "child_process";
import { mkdir, access, writeFile, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { YoutubeTranscript } from "youtube-transcript";
import { findGoldenSpots, TranscriptSegment } from "./src/lib/placement";

// ─── Output root ──────────────────────────────────────────────────────────────

const OUTPUTS_ROOT = join(process.cwd(), "outputs");

// ─── Binary resolution ────────────────────────────────────────────────────────

function resolveBin(name: string, flag: string, candidates: string[]): string {
  for (const p of candidates) {
    try { execFileSync(p, [flag], { stdio: "ignore" }); return p; } catch { /* next */ }
  }
  throw new Error(`${name} not found — install with: brew install ${name}`);
}

const FFMPEG = resolveBin("ffmpeg", "-version", [
  "/opt/homebrew/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
  "ffmpeg",
]);

const YTDLP = resolveBin("yt-dlp", "--version", [
  "/opt/homebrew/bin/yt-dlp",
  "/usr/local/bin/yt-dlp",
  "yt-dlp",
]);

// ─── Transcript ───────────────────────────────────────────────────────────────

async function fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
  const toSegments = (raw: Awaited<ReturnType<typeof YoutubeTranscript.fetchTranscript>>) =>
    raw.map((e) => ({ text: e.text, start: e.offset / 1000, duration: e.duration / 1000 }));

  for (const lang of ["en", "fr", undefined] as const) {
    try {
      const raw = await YoutubeTranscript.fetchTranscript(videoId, lang ? { lang } : undefined);
      if (raw.length) return toSegments(raw);
    } catch { /* try next */ }
  }
  throw new Error("No transcript available for this video.");
}

// ─── Video download ───────────────────────────────────────────────────────────

async function ensureVideo(videoId: string): Promise<string> {
  const cachePath = join(tmpdir(), `yt_${videoId}.mp4`);
  try {
    await access(cachePath);
    console.log(`  (cached) ${cachePath}`);
    return cachePath;
  } catch { /* not cached */ }

  console.log("  Downloading video…");
  execFileSync(YTDLP, [
    "-f", "worst[ext=mp4]/worst",
    "--extractor-args", "youtube:player_client=android",
    "--no-warnings", "-q",
    "-o", cachePath,
    `https://www.youtube.com/watch?v=${videoId}`,
  ], { stdio: "inherit" });

  return cachePath;
}

// ─── Frame extraction ─────────────────────────────────────────────────────────

function extractFrame(videoPath: string, timeSec: number, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, [
      "-y",
      "-ss", timeSec.toFixed(3),
      "-i", videoPath,
      "-frames:v", "1",
      "-q:v", "2",
      "-f", "image2",
      outputPath,
    ], (_err, _stdout, stderr) => {
      if (stderr.includes("Invalid data found") || stderr.includes("No such file")) {
        reject(new Error(stderr.slice(-300)));
      } else {
        resolve();
      }
    });
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HandoffSpot {
  id: string;
  timestamp_seconds: number;
  frame_a_time: number;
  frame_b_time: number;
  frame_a_path: string;
  frame_b_path: string;
}

export interface HandoffResult {
  video_id: string;
  spots: HandoffSpot[];
}

// ─── Core function (used by CLI and server) ───────────────────────────────────

/**
 * Runs the full analysis pipeline for a video.
 * - If outputs/VIDEO_ID/handoff.json already exists, returns it immediately (cache hit).
 * - Otherwise fetches transcript, scores spots, downloads video, extracts frames.
 *
 * @param videoId  YouTube video ID
 * @param baseUrl  Optional base URL (e.g. "http://localhost:3000") — when set,
 *                 frame paths are returned as full URLs instead of relative paths.
 */
export async function analyzeVideo(videoId: string, baseUrl?: string): Promise<HandoffResult> {
  const videoDir    = join(OUTPUTS_ROOT, videoId);
  const handoffPath = join(videoDir, "handoff.json");

  // Cache: return existing result if folder already processed
  try {
    await access(handoffPath);
    const raw    = await readFile(handoffPath, "utf8");
    const cached = JSON.parse(raw) as HandoffResult;
    if (baseUrl) return injectBaseUrl(cached, videoId, baseUrl);
    return cached;
  } catch { /* not cached yet */ }

  // Fetch transcript and score spots
  const transcript = await fetchTranscript(videoId);
  const spots      = findGoldenSpots(transcript, 3);

  if (spots.length === 0) throw new Error("No injection spots found — transcript too short or too uniform.");

  await mkdir(videoDir, { recursive: true });

  const videoPath = await ensureVideo(videoId);

  const handoffSpots = await Promise.all(spots.map(async (spot, i) => {
    const spotId  = `spot_${i + 1}`;
    const spotDir = join(videoDir, spotId);
    await mkdir(spotDir, { recursive: true });

    const frameAPath = join(spotDir, "frame_a.jpg");
    const frameBPath = join(spotDir, "frame_b.jpg");
    const frameBTime = spot.frame_a_time + 5;

    await extractFrame(videoPath, spot.frame_a_time, frameAPath);
    await extractFrame(videoPath, frameBTime, frameBPath);

    return {
      id:                spotId,
      timestamp_seconds: parseFloat(spot.frame_a_time.toFixed(3)),
      frame_a_time:      spot.frame_a_time,
      frame_b_time:      spot.frame_b_time,
      frame_a_path:      `./${spotId}/frame_a.jpg`,
      frame_b_path:      `./${spotId}/frame_b.jpg`,
    };
  }));

  const result: HandoffResult = { video_id: videoId, spots: handoffSpots };

  await writeFile(handoffPath, JSON.stringify(result, null, 2));

  if (baseUrl) return injectBaseUrl(result, videoId, baseUrl);
  return result;
}

/** Replaces relative paths with full URLs for API responses. */
function injectBaseUrl(result: HandoffResult, videoId: string, baseUrl: string): HandoffResult {
  return {
    ...result,
    spots: result.spots.map((s) => ({
      ...s,
      frame_a_path: `${baseUrl}/outputs/${videoId}/${s.id}/frame_a.jpg`,
      frame_b_path: `${baseUrl}/outputs/${videoId}/${s.id}/frame_b.jpg`,
    })),
  };
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

if (require.main === module || process.argv[1]?.endsWith("handoff.ts")) {
  const videoId = process.argv[2];
  if (!videoId) {
    console.error("Usage: npx tsx handoff.ts <VIDEO_ID>");
    process.exit(1);
  }
  console.log(`\nAnalyzing ${videoId}…`);
  analyzeVideo(videoId)
    .then((result) => {
      const dir = join(OUTPUTS_ROOT, videoId);
      console.log(`\nhandoff.json → ${join(dir, "handoff.json")}`);
      console.log(`\n✅ READY: ${dir}\n`);
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
}
