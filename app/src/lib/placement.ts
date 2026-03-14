// ─────────────────────────────────────────────────────────────────────────────
// placement.ts — Public API for the Golden Integration Point engine
//
// Consumers (API routes, UI) import only from this file.
// All scoring logic lives in scoring-engine.ts; keywords in keywords.ts.
//
// Teammate handoff contract:
//   frame_a_time → last frame of the high-energy hook  (Peak Intensity)
//   frame_b_time → first frame of the new section      (The Pivot)
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildAIPrompt,
  detectLanguage,
  scoreTransition,
  type ScoredGap,
} from "./scoring-engine";

// ── Shared input type (re-exported for consumers) ─────────────────────────────

export interface TranscriptSegment {
  text: string;
  start: number;    // seconds
  duration: number; // seconds
}

// ── Output types ──────────────────────────────────────────────────────────────

export interface GoldenSpot {
  spot_id: string;
  timestamp: string;
  intensity_score: number;       // 0–100
  frame_a_time: number;          // seconds — last frame of high-energy hook
  frame_b_time: number;          // seconds — first frame of new section
  context: string;               // "Transition from [Hook] → [New Topic]"
  language: "fr" | "en";
  ai_prompt_suggestion: string;
}

/** Backward-compatible shape used by the studio UI */
export interface PlacementWindow {
  startTime: number;
  endTime: number;
  score: number;
  reason: string;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Core selection logic ──────────────────────────────────────────────────────

function selectTopGaps(
  segments: TranscriptSegment[],
  topN: number,
  minSpacingSec: number,
): ScoredGap[] {
  const lang          = detectLanguage(segments);
  const totalDuration = segments[segments.length - 1].start +
                        segments[segments.length - 1].duration;

  const candidates: ScoredGap[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const gap = scoreTransition(segments[i], segments[i + 1], totalDuration, lang);
    if (gap) candidates.push(gap);
  }

  const sorted   = [...candidates].sort((a, b) => b.intensityScore - a.intensityScore);
  const selected: ScoredGap[] = [];
  for (const gap of sorted) {
    if (selected.length === topN) break;
    const tooClose = selected.some((s) => Math.abs(s.frameA - gap.frameA) < minSpacingSec);
    if (!tooClose) selected.push(gap);
  }

  return selected.sort((a, b) => a.frameA - b.frameA);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the Top-N "Golden Integration Points" for AI sponsor injection.
 * Language (EN/FR) is auto-detected from the transcript content.
 */
export function findGoldenSpots(
  segments: TranscriptSegment[],
  topN: number = 2,
  minSpacingSec: number = 45,
): GoldenSpot[] {
  if (segments.length < 2) return [];

  return selectTopGaps(segments, topN, minSpacingSec).map((gap, i) => ({
    spot_id:              `sponsor_${i + 1}`,
    timestamp:            formatTimestamp(gap.frameA),
    intensity_score:      gap.intensityScore,
    frame_a_time:         parseFloat(gap.frameA.toFixed(3)),
    frame_b_time:         parseFloat(gap.frameB.toFixed(3)),
    context:              `Transition from "${gap.prevTopic}" → "${gap.nextTopic}"`,
    language:             gap.lang,
    ai_prompt_suggestion: buildAIPrompt(gap),
  }));
}

/** Backward-compatible wrapper used by the studio UI. */
export function findTopPlacements(
  segments: TranscriptSegment[],
  topN: number = 3,
  adDurationSeconds: number = 30,
  minSpacingSec: number = 45,
): PlacementWindow[] {
  const spots = findGoldenSpots(segments, topN, minSpacingSec);
  if (spots.length === 0) {
    const fallback = segments[0]?.start ?? 60;
    return [{ startTime: fallback, endTime: fallback + adDurationSeconds, score: 0, reason: "Fallback placement." }];
  }
  return spots.map((s) => ({
    startTime: s.frame_a_time,
    endTime:   s.frame_b_time + adDurationSeconds,
    score:     s.intensity_score,
    reason:    s.context,
  }));
}

/** Convenience wrapper — single best placement. */
export function findBestPlacement(
  segments: TranscriptSegment[],
  adDurationSeconds: number = 30,
): PlacementWindow {
  return findTopPlacements(segments, 1, adDurationSeconds)[0];
}
