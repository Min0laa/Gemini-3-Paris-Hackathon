/**
 * extract-frames.ts — Frame Extraction Utility
 *
 * Downloads the video once via yt-dlp (low quality, cached in /tmp),
 * then extracts JPEG frames with ffmpeg (-ss before -i for fast seek).
 *
 * Output:
 *   output_frames/VIDEO_ID_YYYYMMDD_HHMM/
 *     spot_N/frame_a.jpg  — injection point (lighting reference)
 *     spot_N/frame_b.jpg  — 5s later (visual verification, distinct from A)
 *
 * frame_b_time in the manifest stays frame_a + 0.1s (renderer contract).
 *
 * Requires: yt-dlp + ffmpeg  (brew install yt-dlp ffmpeg)
 */

import { execFileSync, execFile } from "child_process";
import { mkdir, access }          from "fs/promises";
import { tmpdir }                 from "os";
import { join }                   from "path";
import { GoldenSpot }             from "./src/lib/placement";

// ─── Constants ────────────────────────────────────────────────────────────────

const OUTPUT_ROOT = join(process.cwd(), "output_frames");

// ─── Binary resolution ────────────────────────────────────────────────────────

function resolveBin(name: string, flag: string, candidates: string[]): string {
  for (const p of candidates) {
    try { execFileSync(p, [flag], { stdio: "ignore" }); return p; } catch { /* next */ }
  }
  throw new Error(`${name} not found. Install with: brew install ${name}`);
}

const FFMPEG = resolveBin("ffmpeg",  "-version",  ["/opt/homebrew/bin/ffmpeg",  "/usr/local/bin/ffmpeg",  "ffmpeg"]);
const YTDLP  = resolveBin("yt-dlp", "--version", [
  "/opt/homebrew/bin/yt-dlp",
  "/usr/local/bin/yt-dlp",
  "yt-dlp",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number): string { return String(n).padStart(2, "0"); }

function sessionFolder(videoId: string): string {
  const now  = new Date();
  const date = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}${pad2(now.getMinutes())}`;
  return join(OUTPUT_ROOT, `${videoId}_${date}_${time}`);
}

/** Creates the session output folder and returns its path. */
export async function createOutputDir(videoId: string): Promise<string> {
  const dir = sessionFolder(videoId);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Downloads the video once at low quality; re-uses cache on subsequent runs. */
async function ensureVideoDownloaded(videoId: string): Promise<string> {
  const cachePath = join(tmpdir(), `yt_${videoId}.mp4`);

  try {
    await access(cachePath);
    console.log(`  (using cached video: ${cachePath})`);
    return cachePath;
  } catch { /* not cached yet */ }

  console.log(`  Downloading video (low quality, cached for this session)…`);
  execFileSync(
    YTDLP,
    [
      "-f", "worst[ext=mp4]/worst",        // lowest quality = fastest
      "--extractor-args", "youtube:player_client=android",  // bypass bot detection
      "--no-warnings", "-q",
      "-o", cachePath,
      `https://www.youtube.com/watch?v=${videoId}`,
    ],
    { stdio: "inherit" },   // show download progress in terminal
  );
  return cachePath;
}

/**
 * Extracts a single JPEG frame at `timeSec` from a LOCAL video file.
 * -ss BEFORE -i = fast keyframe seek, then decode only the target frame.
 */
function extractFrameFromFile(
  videoPath:  string,
  timeSec:    number,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      FFMPEG,
      [
        "-y",
        "-ss", timeSec.toFixed(3),   // fast seek before input
        "-i", videoPath,
        "-frames:v", "1",
        "-q:v", "2",                 // near-lossless JPEG
        "-f", "image2",
        outputPath,
      ],
      (_err, _stdout, stderr) => {
        if (stderr.includes("Invalid data found") || stderr.includes("No such file")) {
          reject(new Error(stderr.slice(-300)));
        } else {
          resolve();                  // ffmpeg exits non-zero even on success
        }
      },
    );
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function extractGoldenFrames(
  videoId: string,
  spots:   GoldenSpot[],
): Promise<string> {
  const videoPath  = await ensureVideoDownloaded(videoId);
  const sessionDir = sessionFolder(videoId);

  for (let i = 0; i < spots.length; i++) {
    const spot    = spots[i];
    const spotDir = join(sessionDir, `spot_${i + 1}`);
    await mkdir(spotDir, { recursive: true });

    const frameAPath = join(spotDir, "frame_a.jpg");
    const frameBPath = join(spotDir, "frame_b.jpg");

    process.stdout.write(`  Spot ${i + 1}  frame_a @ ${spot.frame_a_time.toFixed(2)}s … `);
    await extractFrameFromFile(videoPath, spot.frame_a_time, frameAPath);
    console.log(`✅  ${frameAPath}`);

    const frameBVisualTime = spot.frame_a_time + 5;
    process.stdout.write(`  Spot ${i + 1}  frame_b @ ${frameBVisualTime.toFixed(2)}s … `);
    await extractFrameFromFile(videoPath, frameBVisualTime, frameBPath);
    console.log(`✅  ${frameBPath}`);
  }

  console.log(`\n📂 All frames saved → ${sessionDir}\n`);
  return sessionDir;
}
