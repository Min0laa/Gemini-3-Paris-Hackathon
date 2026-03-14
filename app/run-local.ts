/**
 * run-local.ts — CLI for the Perfect Entry Point Engine
 *
 * Usage:
 *   npx tsx run-local.ts <VIDEO_ID>              # scores + frame extraction
 *   npx tsx run-local.ts <VIDEO_ID> --no-frames  # scores only
 */

import { writeFile }       from "fs/promises";
import { join }            from "path";
import { YoutubeTranscript } from "youtube-transcript";
import { findGoldenSpots, detectLanguage, TranscriptSegment, GoldenSpot } from "./src/lib/placement";
import { validateAndGenerateAd } from "./src/lib/gemini-service";
import { extractGoldenFrames, createOutputDir } from "./extract-frames";

// ─── Terminal colours ──────────────────────────────────────────────────────
const GRN = "\x1b[32m";
const YLW = "\x1b[33m";
const CYN = "\x1b[36m";
const BLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

// ─── Transcript fetcher ────────────────────────────────────────────────────
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

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const videoId   = process.argv[2];
  const noFrames  = process.argv.includes("--no-frames");

  if (!videoId) {
    console.error("Usage: npx tsx run-local.ts <VIDEO_ID> [--no-frames]");
    process.exit(1);
  }

  console.log(`\n${BLD}${CYN}Golden Integration Point Engine${RST}`);
  console.log(`${DIM}Video: https://youtu.be/${videoId}${RST}\n`);

  let transcript: TranscriptSegment[];
  try {
    transcript = await fetchTranscript(videoId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\x1b[31mError: ${msg}\x1b[0m`);
    process.exit(1);
  }

  const lang  = detectLanguage(transcript);
  const spots = findGoldenSpots(transcript, 3);

  console.log(`${DIM}Language detected : ${lang.toUpperCase()}${RST}`);
  console.log(`${DIM}Segments fetched  : ${transcript.length}${RST}`);
  console.log(`${DIM}Spots found       : ${spots.length}${RST}\n`);

  if (spots.length === 0) {
    console.log(`${YLW}No spots found — transcript may be too short or too uniform.${RST}`);
    process.exit(0);
  }

  for (const spot of spots) {
    const result = await validateAndGenerateAd({
      video_id:     videoId,
      frame_a_time: spot.frame_a_time,
      frame_b_time: spot.frame_b_time,
      prev_text:    spot.context,
      next_text:    "",
      local_score:  spot.intensity_score,
      language:     spot.language,
    });

    const scoreColor = result.validated_score >= 80 ? GRN : result.validated_score >= 60 ? YLW : RST;

    console.log(`${BLD}${spot.spot_id.toUpperCase()}${RST}  @  ${CYN}${spot.timestamp}${RST}`);
    console.log(`  Score       ${scoreColor}${BLD}${result.validated_score}/100${RST}`);
    console.log(`  Context     ${spot.context}`);
    console.log(`  frame_a     ${spot.frame_a_time.toFixed(2)}s`);
    console.log(`  frame_b     ${spot.frame_b_time.toFixed(2)}s  ${DIM}(+${spot.ad_duration_to_inject}s ad)${RST}`);
    console.log(`  AI prompt   ${DIM}${result.ai_generation_prompt}${RST}`);
    console.log();
  }

  // ─── Teammate Handoff Manifest ───────────────────────────────────────────
  const manifest = buildManifest(videoId, spots);

  console.log(`${BLD}${GRN}── Teammate Handoff Manifest ──────────────────────────────${RST}`);
  console.log(JSON.stringify(manifest, null, 2));

  // ─── Frame Extraction + Save manifest.json ───────────────────────────────
  if (noFrames) {
    console.log(`\n${DIM}(frame extraction skipped — remove --no-frames to enable)${RST}`);
    const outputDir = await createOutputDir(videoId);
    await saveManifest(outputDir, manifest);
    printHandoff(outputDir);
    return;
  }

  console.log(`\n${BLD}${CYN}── Extracting Frames ──────────────────────────────────────${RST}`);
  try {
    const outputDir = await extractGoldenFrames(videoId, spots);
    await saveManifest(outputDir, manifest);
    printHandoff(outputDir);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${YLW}⚠ Frame extraction failed: ${msg}${RST}`);
    console.error(`${DIM}Tip: make sure ffmpeg + yt-dlp are installed → brew install ffmpeg yt-dlp${RST}`);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildManifest(videoId: string, spots: GoldenSpot[]) {
  return {
    video_id:   videoId,
    generated:  new Date().toISOString(),
    spots: spots.map((s) => ({
      spot_id:               s.spot_id,
      timestamp:             s.timestamp,
      score:                 s.intensity_score,
      frame_a_time:          s.frame_a_time,
      frame_b_time:          s.frame_b_time,
      ad_duration_to_inject: s.ad_duration_to_inject,
      last_creator_words:    s.last_creator_words,
      language:              s.language,
      ai_prompt:             s.ai_prompt_suggestion,
      frames: {
        frame_a: `spot_${s.spot_id.split("_")[1]}/frame_a.jpg`,
        frame_b: `spot_${s.spot_id.split("_")[1]}/frame_b.jpg`,
      },
    })),
  };
}

function printHandoff(outputDir: string) {
  console.log(`\n${BLD}${GRN}✅ READY FOR HANDOFF${RST}`);
  console.log(`   Folder: ${CYN}${outputDir}${RST}`);
  console.log(`   Contains: manifest.json + spot_N/frame_a.jpg + spot_N/frame_b.jpg`);
  console.log(`   ${DIM}Frame paths in manifest.json are relative — use the folder as base path.${RST}\n`);
}

async function saveManifest(outputDir: string, manifest: ReturnType<typeof buildManifest>) {
  const finalManifest = { ...manifest, output_dir: outputDir };
  const path = join(outputDir, "manifest.json");
  await writeFile(path, JSON.stringify(finalManifest, null, 2));
  console.log(`📄 Manifest saved  → ${path}`);
}

main();
