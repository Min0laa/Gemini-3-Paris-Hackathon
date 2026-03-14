/**
 * run-local.ts — Local Golden Spot runner
 *
 * Usage:
 *   npx tsx run-local.ts <VIDEO_ID>
 *
 * Example:
 *   npx tsx run-local.ts GAhAbMLZdeE
 *
 * Pipeline:
 *   1. Fetch raw transcript via youtube-transcript
 *   2. Run local scoring engine  (WPM spike + multilingual keywords + silence gap)
 *   3. Run Gemini validation     (mock for now — see gemini-service.ts)
 *   4. Print Golden Spots to console
 */

import { YoutubeTranscript } from "youtube-transcript";
import { detectLanguage, findGoldenSpots, formatTimestamp, TranscriptSegment } from "./src/lib/placement";
import { validateSpotWithGemini } from "./src/lib/gemini-service";

// ── 1. Parse CLI argument ─────────────────────────────────────────────────────

const videoId = process.argv[2];
if (!videoId) {
  console.error("\nUsage: npx tsx run-local.ts <VIDEO_ID>\n");
  process.exit(1);
}

const SEP  = "─".repeat(72);
const DIM  = "\x1b[2m";
const BOLD = "\x1b[1m";
const GRN  = "\x1b[32m";
const YLW  = "\x1b[33m";
const RST  = "\x1b[0m";

// ── 2. Fetch transcript ───────────────────────────────────────────────────────

async function fetchTranscript(id: string): Promise<TranscriptSegment[]> {
  const toSegments = (raw: Awaited<ReturnType<typeof YoutubeTranscript.fetchTranscript>>) =>
    raw.map((e) => ({ text: e.text, start: e.offset / 1000, duration: e.duration / 1000 }));

  for (const lang of ["en", "fr", undefined] as const) {
    try {
      const raw = await YoutubeTranscript.fetchTranscript(id, lang ? { lang } : undefined);
      if (raw.length) return toSegments(raw);
    } catch { /* try next */ }
  }
  throw new Error("No transcript available.");
}

// ── 3. Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${SEP}`);
  console.log(`${BOLD}  Golden Integration Point — Local Runner${RST}`);
  console.log(`  Video ID : ${videoId}`);
  console.log(SEP);

  // Fetch
  process.stdout.write("\n  [1/3] Fetching transcript … ");
  let segments: TranscriptSegment[];
  try {
    segments = await fetchTranscript(videoId);
  } catch {
    console.log("✗");
    console.error(`\n  Error: Could not fetch transcript for "${videoId}".`);
    console.error("  The video may have captions disabled or the ID is invalid.\n");
    process.exit(1);
  }

  const totalDuration = segments[segments.length - 1].start + segments[segments.length - 1].duration;
  const lang          = detectLanguage(segments);
  console.log(`✓  (${segments.length} segments, ${formatTimestamp(totalDuration)}, lang=${lang.toUpperCase()})`);

  // Score
  process.stdout.write("  [2/3] Running local scoring engine … ");
  const spots = findGoldenSpots(segments, 2);
  console.log(`✓  (${spots.length} Golden Spot${spots.length !== 1 ? "s" : ""} found)`);

  if (spots.length === 0) {
    console.log("\n  No Golden Spots detected. The video may be too short or");
    console.log("  all transitions fall outside the 20%–70% safety zone.\n");
    process.exit(0);
  }

  // Gemini validation (mock)
  process.stdout.write("  [3/3] Gemini validation … ");
  const validated = await Promise.all(
    spots.map((s, i) =>
      validateSpotWithGemini({
        prevText:   segments.find((seg) => Math.abs((seg.start + seg.duration) - s.frame_a_time) < 0.5)?.text ?? "",
        nextText:   segments.find((seg) => Math.abs(seg.start - s.frame_b_time) < 0.5)?.text ?? "",
        localScore: s.intensity_score,
        language:   s.language,
      }).then((v) => ({ ...s, ...v, index: i + 1 }))
    )
  );
  const geminiActive = validated[0]?.geminiUsed ?? false;
  console.log(geminiActive ? "✓  (real API)" : `${YLW}⚠  mock mode — Gemini not yet active${RST}`);

  // ── Print results ───────────────────────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log(`${BOLD}  Results${RST}`);
  console.log(SEP);

  for (const spot of validated) {
    const scoreBar = GRN + "█".repeat(Math.round(spot.validatedScore / 5)) + RST +
                     DIM  + "░".repeat(20 - Math.round(spot.validatedScore / 5)) + RST;

    console.log(`\n  ${BOLD}Spot ${spot.index} — ${spot.spot_id}${RST}  [${spot.timestamp}]`);
    console.log(`  Score       ${scoreBar}  ${BOLD}${spot.validatedScore}/100${RST}`);
    console.log(`  Language    ${spot.language.toUpperCase()}`);
    console.log(`  Frame A     ${spot.frame_a_time}s   ← last frame of high-energy segment`);
    console.log(`  Frame B     ${spot.frame_b_time}s   ← first frame of new section`);
    const silence = spot.frame_b_time - spot.frame_a_time;
    const silenceStr = silence < 0
      ? `${YLW}⚠ overlapping captions (${silence.toFixed(2)}s) — verify manually${RST}`
      : `${silence.toFixed(2)}s gap between frames`;
    console.log(`  Silence     ${silenceStr}`);
    console.log(`  Context     ${spot.context}`);
    console.log(`  AI Prompt   ${DIM}${spot.ai_prompt_suggestion}${RST}`);
    if (!spot.geminiUsed) {
      console.log(`  Gemini      ${DIM}${spot.reasoning}${RST}`);
    } else {
      console.log(`  Gemini      confidence=${spot.confidence}  "${spot.reasoning}"`);
    }
  }

  // ── Teammate handoff summary ────────────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log(`${BOLD}  Teammate Handoff Manifest${RST}`);
  console.log(SEP);
  const manifest = validated.map((s) => ({
    spot_id:     s.spot_id,
    timestamp:   s.timestamp,
    frame_a:     s.frame_a_time,
    frame_b:     s.frame_b_time,
    score:       s.validatedScore,
    language:    s.language,
    ai_prompt:   s.ai_prompt_suggestion,
  }));
  console.log(JSON.stringify(manifest, null, 2));
  console.log(`\n${SEP}\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
