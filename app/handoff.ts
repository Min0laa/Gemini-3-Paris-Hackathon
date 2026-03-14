/**
 * handoff.ts — Clean technical output for teammate integration
 *
 * Usage:
 *   npx tsx handoff.ts <VIDEO_ID>
 *
 * Output:
 *   outputs/VIDEO_ID/
 *     handoff.json          — raw timestamps only, no AI/scoring data
 *     spot_1/frame_a.jpg    — injection point frame
 *     spot_1/frame_b.jpg    — 5s later (visual reference)
 *     spot_2/...
 *     spot_3/...
 *
 * Requires: yt-dlp + ffmpeg  (brew install yt-dlp ffmpeg)
 */

import { execFileSync, execFile } from "child_process";
import { mkdir, access, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { YoutubeTranscript } from "youtube-transcript";
import { findGoldenSpots, detectLanguage, TranscriptSegment } from "./src/lib/placement";

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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const videoId = process.argv[2];
  if (!videoId) {
    console.error("Usage: npx tsx handoff.ts <VIDEO_ID>");
    process.exit(1);
  }

  // 1. Fetch transcript and find injection points
  console.log(`\nFetching transcript for ${videoId}…`);
  const transcript = await fetchTranscript(videoId);
  const spots      = findGoldenSpots(transcript, 3);

  if (spots.length === 0) {
    console.error("No spots found — transcript may be too short.");
    process.exit(1);
  }

  // 2. Create output directory: outputs/VIDEO_ID/
  const videoDir = join(OUTPUTS_ROOT, videoId);
  await mkdir(videoDir, { recursive: true });

  // 3. Download video (cached after first run)
  console.log("Preparing video…");
  const videoPath = await ensureVideo(videoId);

  // 4. Extract frames for each spot
  console.log("Extracting frames…");

  const handoffSpots = await Promise.all(spots.map(async (spot, i) => {
    const spotId  = `spot_${i + 1}`;
    const spotDir = join(videoDir, spotId);
    await mkdir(spotDir, { recursive: true });

    const frameAPath = join(spotDir, "frame_a.jpg");
    const frameBPath = join(spotDir, "frame_b.jpg");
    const frameBTime = spot.frame_a_time + 5; // 5s later for visual distinction

    await extractFrame(videoPath, spot.frame_a_time, frameAPath);
    console.log(`  ${spotId}/frame_a.jpg  @  ${spot.frame_a_time.toFixed(3)}s`);

    await extractFrame(videoPath, frameBTime, frameBPath);
    console.log(`  ${spotId}/frame_b.jpg  @  ${frameBTime.toFixed(3)}s`);

    return {
      id:                spotId,
      timestamp_seconds: parseFloat(spot.frame_a_time.toFixed(3)),
      frame_a_time:      spot.frame_a_time,
      frame_b_time:      spot.frame_b_time,
      frame_a_path:      `./${spotId}/frame_a.jpg`,
      frame_b_path:      `./${spotId}/frame_b.jpg`,
    };
  }));

  // 5. Write handoff.json
  const handoff = {
    video_id: videoId,
    spots:    handoffSpots,
  };

  const handoffPath = join(videoDir, "handoff.json");
  await writeFile(handoffPath, JSON.stringify(handoff, null, 2));

  console.log(`\nhandoff.json → ${handoffPath}`);
  console.log(`\n✅ READY: ${videoDir}\n`);
}

main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
