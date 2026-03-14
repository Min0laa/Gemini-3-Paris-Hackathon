/**
 * test-bulk.ts — Bulk QA script for the Golden Integration Point engine.
 *
 * Tests the full pipeline (transcript fetch → language detection → scoring)
 * against a curated list of videos covering edge cases.
 *
 * Run: npx tsx test-bulk.ts
 */

import { YoutubeTranscript } from "youtube-transcript";
import { detectLanguage, findGoldenSpots, formatTimestamp, TranscriptSegment } from "./src/lib/placement";

// ── Test suite definition ─────────────────────────────────────────────────────

interface TestCase {
  id: string;
  label: string;
  expectedLang?: "fr" | "en";
  expectError?: boolean; // true = captions should be disabled / unreachable
}

const TEST_CASES: TestCase[] = [
  // ── Normal cases ────────────────────────────────────────────────────────────
  {
    id:           "GAhAbMLZdeE",
    label:        "FR vlog — Nos aventures aux États-Unis (17:47)",
    expectedLang: "fr",
  },
  {
    id:           "dQw4w9WgXcQ",
    label:        "EN music — Rick Astley Never Gonna Give You Up (3:33)",
    expectedLang: "en",
  },
  {
    id:           "jNQXAC9IVRw",
    label:        "SHORT — Me at the zoo, first YouTube video ever (0:19) [edge: too short]",
    expectedLang: "en",
  },
  {
    id:           "PkZNo7MFNFg",
    label:        "LONG — freeCodeCamp JS full course (3h 26min) [edge: very long]",
    expectedLang: "en",
  },
  {
    id:           "LXb3EKWsInQ",
    label:        "FR tech — Fireship Code Report (< 2 min) [edge: very short FR-ish]",
  },
  {
    id:           "9bZkp7q19f0",
    label:        "EN music — Gangnam Style (4:13)",
    expectedLang: "en",
  },
  // ── Edge case: disabled / auto-generated captions only ────────────────────
  {
    id:          "INVALID_VIDEO_XYZ",
    label:       "ERROR — non-existent video ID [expect 422 / fetch error]",
    expectError: true,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const DELAY_MS = 600;
const SEPARATOR = "─".repeat(80);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function videoDuration(segments: TranscriptSegment[]): string {
  if (!segments.length) return "0:00";
  const last = segments[segments.length - 1];
  return formatTimestamp(last.start + last.duration);
}

function pad(str: string, len: number) {
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

function printRow(
  videoId: string,
  lang: string,
  spotsFound: number,
  bestTimestamp: string,
  bestScore: number,
  reason: string,
  duration: string,
  status: "OK" | "WARN" | "FAIL",
) {
  const statusColor = status === "OK" ? "\x1b[32m" : status === "WARN" ? "\x1b[33m" : "\x1b[31m";
  const reset       = "\x1b[0m";
  const reasonShort = reason.length > 50 ? reason.slice(0, 47) + "…" : reason;

  console.log(
    `${statusColor}[${status}]${reset}` +
    ` ${pad(videoId, 14)}` +
    ` | lang=${pad(lang, 2)}` +
    ` | dur=${pad(duration, 8)}` +
    ` | spots=${spotsFound}` +
    ` | best=${pad(bestTimestamp, 6)} (score=${pad(String(bestScore), 3)})` +
    ` | ${reasonShort}`
  );
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function runBulkTest() {
  console.log("\n" + SEPARATOR);
  console.log("  Golden Integration Point — Bulk QA Test");
  console.log(`  ${TEST_CASES.length} videos  |  ${DELAY_MS}ms delay between requests`);
  console.log(SEPARATOR + "\n");

  const results: { id: string; status: "OK" | "WARN" | "FAIL"; issue?: string }[] = [];

  for (const tc of TEST_CASES) {
    process.stdout.write(`  Fetching ${tc.id} (${tc.label})…`);

    // ── Fetch transcript ────────────────────────────────────────────────────
    let segments: TranscriptSegment[];
    try {
      const raw = await YoutubeTranscript.fetchTranscript(tc.id);
      segments = raw.map((e) => ({
        text:     e.text,
        start:    e.offset   / 1000,
        duration: e.duration / 1000,
      }));
      process.stdout.write(" ✓\n");
    } catch (err: unknown) {
      process.stdout.write(" ✗\n");
      const msg = err instanceof Error ? err.message : String(err);
      if (tc.expectError) {
        printRow(tc.id, "—", 0, "—", 0, `Expected error: ${msg.slice(0, 50)}`, "—", "OK");
        results.push({ id: tc.id, status: "OK" });
      } else {
        printRow(tc.id, "—", 0, "—", 0, `UNEXPECTED error: ${msg.slice(0, 40)}`, "—", "FAIL");
        results.push({ id: tc.id, status: "FAIL", issue: msg });
      }
      await sleep(DELAY_MS);
      continue;
    }

    // ── If we expected an error but got a transcript, mark WARN ────────────
    if (tc.expectError) {
      printRow(tc.id, "—", 0, "—", 0, "Expected error but transcript was returned", "—", "WARN");
      results.push({ id: tc.id, status: "WARN", issue: "Expected no transcript" });
      await sleep(DELAY_MS);
      continue;
    }

    // ── Short transcript guard ──────────────────────────────────────────────
    if (segments.length < 2) {
      printRow(tc.id, "—", 0, "—", 0, `Only ${segments.length} segment(s) — too short to score`, "—", "WARN");
      results.push({ id: tc.id, status: "WARN", issue: "Transcript too short" });
      await sleep(DELAY_MS);
      continue;
    }

    // ── Run engine ──────────────────────────────────────────────────────────
    const lang       = detectLanguage(segments);
    const spots      = findGoldenSpots(segments, 2);
    const duration   = videoDuration(segments);
    const bestSpot   = spots.sort((a, b) => b.intensity_score - a.intensity_score)[0];

    // ── Language assertion ──────────────────────────────────────────────────
    let status: "OK" | "WARN" | "FAIL" = "OK";
    let issue: string | undefined;

    if (tc.expectedLang && lang !== tc.expectedLang) {
      status = "WARN";
      issue  = `Expected lang=${tc.expectedLang} but got lang=${lang}`;
    }

    if (!bestSpot) {
      status = "WARN";
      issue  = "No golden spots found (video may be in safety zone or too short)";
      printRow(tc.id, lang, 0, "—", 0, issue, duration, status);
    } else {
      printRow(
        tc.id,
        lang,
        spots.length,
        bestSpot.timestamp,
        bestSpot.intensity_score,
        bestSpot.context,
        duration,
        status,
      );

      // Print all spots for this video
      for (const s of spots) {
        console.log(
          `            └─ ${s.spot_id}  ${s.timestamp}` +
          `  score=${s.intensity_score}  frameA=${s.frame_a_time}s  frameB=${s.frame_b_time}s`
        );
        console.log(`               ${s.ai_prompt_suggestion.slice(0, 78)}`);
      }

      if (issue) console.log(`  \x1b[33m⚠  ${issue}\x1b[0m`);
    }

    results.push({ id: tc.id, status, issue });
    await sleep(DELAY_MS);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n" + SEPARATOR);
  const ok   = results.filter((r) => r.status === "OK").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  const fail = results.filter((r) => r.status === "FAIL").length;

  console.log(
    `  Summary: \x1b[32m${ok} OK\x1b[0m  \x1b[33m${warn} WARN\x1b[0m  \x1b[31m${fail} FAIL\x1b[0m` +
    `  (${results.length} total)`
  );

  if (warn + fail > 0) {
    console.log("\n  Issues:");
    for (const r of results.filter((r) => r.status !== "OK")) {
      console.log(`    ${r.status}  ${r.id}  — ${r.issue ?? "see above"}`);
    }
  }

  console.log(SEPARATOR + "\n");
  process.exit(fail > 0 ? 1 : 0);
}

runBulkTest().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
