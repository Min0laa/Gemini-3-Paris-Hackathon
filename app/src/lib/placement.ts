// =============================================================================
// placement.ts — Golden Integration Point Engine
//
// Single source of truth for the entire ad-placement scoring pipeline.
// Import from this file only; no other scoring files exist.
//
// Teammate handoff contract:
//   frame_a_time → last frame of the high-energy hook  (Peak Intensity)
//   frame_b_time → first frame of the new section      (The Pivot)
// =============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────

export type Lang = "fr" | "en";

export interface TranscriptSegment {
  text: string;
  start: number;    // seconds from video start
  duration: number; // seconds
}

/** Primary output — one ad placement candidate */
export interface GoldenSpot {
  spot_id: string;
  timestamp: string;
  intensity_score: number;       // 0–100
  frame_a_time: number;          // seconds — last frame of the hook segment
  frame_b_time: number;          // seconds — first frame of the new section
  context: string;
  language: Lang;
  ai_prompt_suggestion: string;
}

/** Backward-compatible shape consumed by the studio UI */
export interface PlacementWindow {
  startTime: number;
  endTime: number;
  score: number;
  reason: string;
}

// ─── Multilingual keyword dictionaries ───────────────────────────────────────
// Each entry: raw string terms → compiled at module load into a single RegExp.
// Add new terms by appending strings to the `terms` array — no regex knowledge needed.

type KW = { pattern: RegExp; weight: number; label: string };

function compile(terms: string[], weight: number, label: string): KW {
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return { pattern: new RegExp(`(${escaped.join("|")})`, "i"), weight, label };
}

// Hook keywords — signal a high-energy climax or reveal in the previous segment
const HOOKS: Record<Lang, KW[]> = {
  en: [
    // High-energy exclamations — very common in challenge/reaction content
    compile(["insane", "incredible", "unbelievable", "mind-blowing", "mind blowing", "unreal"], 20, "wow moment"),
    compile(["impossible", "no way", "oh my god", "oh my gosh", "what the heck"],              20, "wow moment"),
    compile(["crazy", "absolutely crazy", "this is crazy", "that's crazy"],                    18, "wow moment"),
    // Reveal / secret
    compile(["the secret is", "the secret to", "turns out", "the answer is"],                  18, "secret reveal"),
    // Visual hooks — direct viewer attention
    compile(["look at this", "watch this", "check this out", "look at that"],                  15, "visual hook"),
    // Challenge / competition vocabulary (MrBeast core)
    compile(["challenge", "win", "won", "lost", "survived", "eliminated", "last one"],         15, "challenge hook"),
    compile(["$100", "$1,000", "$10,000", "$100,000", "$1,000,000", "million dollars"],        20, "prize reveal"),
    compile(["subscribe", "if you subscribe", "click subscribe"],                              12, "cta hook"),
    // Novelty
    compile(["never seen", "never done", "never been done", "first time ever", "first ever"],  15, "novelty hook"),
    compile(["world record", "guinness", "record-breaking", "largest ever", "biggest ever"],   20, "record hook"),
    // Emphasis markers
    compile(["literally", "honestly", "genuinely", "actually"],                                 8, "emphasis"),
    // Urgency / stakes
    compile(["you need to", "you won't believe", "trust me", "i promise"],                     12, "urgency"),
    compile(["about to", "right now", "happening right now"],                                  10, "live urgency"),
    // Results / payoff
    compile(["it worked", "it actually worked", "we did it", "we won", "we lost"],             15, "result reveal"),
    compile(["doubled", "tripled", "10x", "times more", "times faster"],                       15, "metric spike"),
    // Transformation
    compile(["completely changed", "changed my life", "game changer", "everything changed"],   18, "transformation"),
  ],
  fr: [
    compile(["incroyable", "incroyablement"],                                    20, "wow moment"),
    compile(["dingue", "fou", "folle", "ouf", "magique"],                        18, "wow moment"),
    compile(["le secret est", "le secret c'est"],                                18, "secret reveal"),
    compile(["regardez", "regardez bien", "regardez ça"],                        15, "visual hook"),
    compile(["jamais vu", "première fois", "jamais fait"],                       15, "novelty hook"),
    compile(["littéralement", "franchement", "honnêtement", "vraiment"],          8, "emphasis"),
    compile(["vous devez", "vous allez pas y croire", "croyez-moi"],             12, "urgency"),
    compile(["résultats", "ce qui s'est passé", "ça a marché", "réussi"],        10, "result reveal"),
    compile(["ça change tout", "complètement changé", "révolutionnaire"],        18, "transformation"),
    compile(["doublé", "triplé", "fois plus"],                                   15, "metric spike"),
    compile(["enfin"],                                                            12, "relief moment"),
  ],
};

// Pivot keywords — signal a new section opening in the next segment
const PIVOTS: Record<Lang, KW[]> = {
  en: [
    compile(["but first", "before we go", "before i get", "before we continue"], 30, "classic pivot"),
    compile(["speaking of", "on that note", "with that said"],                   28, "soft pivot"),
    compile(["now let's", "now i want", "now before"],                           25, "now-pivot"),
    compile(["alright", "okay so", "so anyway", "so moving on"],                 22, "section opener"),
    compile(["next up", "moving on", "let's talk", "let's move"],                20, "topic shift"),
    compile(["real quick", "quickly before", "quickly let me"],                  18, "sponsor bridge"),
  ],
  fr: [
    compile(["mais avant", "avant de continuer", "avant d'aller plus loin"],     30, "classic pivot"),
    compile(["en parlant de", "à ce propos", "dans la même veine"],              28, "soft pivot"),
    compile(["maintenant", "passons à", "passons maintenant"],                   25, "now-pivot"),
    compile(["d'ailleurs", "en fait", "du coup", "bref"],                        22, "section opener"),
    compile(["ensuite", "on passe à", "parlons de"],                             20, "topic shift"),
    compile(["rapidement", "vite fait", "juste avant"],                          18, "sponsor bridge"),
  ],
};

// ─── Language detection ───────────────────────────────────────────────────────
// Counts high-frequency function words (EN vs FR) across the full transcript.
// No external library — runs in-memory in < 1ms.

const EN_MARKERS = /\b(the|and|is|are|was|were|this|that|with|for|you|have|been|they)\b/gi;
const FR_MARKERS = /\b(le|la|les|un|une|des|est|sont|avec|pour|vous|nous|ils|elles|que|qui|dans|sur)\b/gi;

export function detectLanguage(segments: TranscriptSegment[]): Lang {
  const text = segments.map((s) => s.text).join(" ");
  const en   = (text.match(EN_MARKERS) ?? []).length;
  const fr   = (text.match(FR_MARKERS) ?? []).length;
  return fr > en ? "fr" : "en";
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

/** Words Per Minute — language-agnostic pacing measure */
function wpm(seg: TranscriptSegment): number {
  return seg.text.trim().split(/\s+/).length / ((seg.duration || 1) / 60);
}

/**
 * Sum hook keyword weights found in text.
 * Cap is raised to 50 if a hook keyword is followed by "!" (hype amplifier).
 * e.g. "Incroyable !" scores higher than a plain "incroyable".
 */
function hookDensity(text: string, lang: Lang): { score: number; label: string; hasExclaim: boolean } {
  let score = 0;
  let label = "";
  let hasKeywordHit = false;

  const hasExclaim = /!/.test(text);
  if (hasExclaim) score += 5;

  for (const kw of HOOKS[lang]) {
    if (kw.pattern.test(text)) {
      score += kw.weight;
      label ||= kw.label;
      hasKeywordHit = true;
    }
  }

  // Hype amplifier: keyword + "!" unlocks a higher cap (50 instead of 40)
  const cap = hasKeywordHit && hasExclaim ? 50 : 40;
  return { score: Math.min(score, cap), label, hasExclaim };
}

/** Return the strongest pivot keyword match, or null */
function pivotStrength(text: string, lang: Lang): { score: number; label: string } | null {
  for (const kw of PIVOTS[lang]) {
    if (kw.pattern.test(text)) return { score: kw.weight, label: kw.label };
  }
  return null;
}

function firstWords(text: string, n = 6): string {
  return text.trim().split(/\s+/).slice(0, n).join(" ").replace(/[,.]$/, "");
}

// ─── Core gap scorer ──────────────────────────────────────────────────────────
// Evaluates the transition between segment[i] (prev) and segment[i+1] (next).
// Returns null if the gap falls outside the 20%–70% safety zone.

interface ScoredGap {
  frameA: number;         // = end of prev segment  (frame_a_time)
  frameB: number;         // = start of next segment (frame_b_time)
  silenceSec: number;     // gap between the two frames
  intensityScore: number; // final 0–100 score
  prevTopic: string;
  nextTopic: string;
  hookLabel: string;
  pivotLabel: string;
  wpmSpike: boolean;
  lang: Lang;
}

function scoreGap(
  prev: TranscriptSegment,
  next: TranscriptSegment,
  totalDuration: number,
  lang: Lang,
  pacing: PacingProfile,
): ScoredGap | null {
  const frameA = prev.start + prev.duration;
  const frameB = next.start;

  // Raw gap — can be slightly negative due to subtitle timing overlap.
  // Overlaps < 1s are treated as zero (caption jitter, not real speech overlap).
  const rawGap     = frameB - frameA;
  const silenceSec = rawGap >= -1.0 ? Math.max(0, rawGap) : rawGap;

  // Hard filter: only score gaps inside 20%–70% of video length.
  // Too early = viewer still in intro; too late = risk of abandonment.
  const relPos = frameA / totalDuration;
  if (relPos < 0.20 || relPos > 0.70) return null;

  let score = 0;

  // 1. WPM Spike (0–25 pts) ─────────────────────────────────────────────────
  // If prev was spoken 20%+ faster than next, the speaker just finished
  // a high-intensity burst and is slowing down — a natural breath.
  // Formula: min((prevWPM/nextWPM - 1) × 50, 25)
  const prevWPM  = wpm(prev);
  const nextWPM  = wpm(next);
  const wpmSpike = prevWPM > nextWPM * 1.20;
  if (wpmSpike) score += Math.min((prevWPM / (nextWPM || 1) - 1) * 50, 25);

  // 1b. Hype Bonus (+15 pts) ────────────────────────────────────────────────
  // A very short segment (< 2s) delivered at high speed is almost always
  // a punchline or exclamation — the speaker's most intense moment.
  if (prev.duration < 2.0 && prevWPM > 120) score += 15;

  // 2. Hook keyword density on prev (0–40 pts, up to 50 if keyword + "!") ──
  // High-engagement words ("incroyable!", "insane", "the secret is…") signal
  // the viewer's attention peaked — ideal moment to capitalise before a cut.
  const hook = hookDensity(prev.text, lang);
  score += hook.score;

  // 3. Relative silence gap (0–20 pts) ─────────────────────────────────────
  // Thresholds are relative to the video's own average silence (pacing profile).
  // A 0.4s gap in a fast-edited MrBeast video scores the same as a 2s gap in
  // a slow vlog — both are unusually long pauses for their respective content.
  // Gate = avg × 1.5; Formula: min(silenceSec / synergyGate × 20, 20)
  if (silenceSec >= pacing.silenceGate) {
    score += Math.min((silenceSec / pacing.synergyGate) * 20, 20);
  }

  // 3b. Synergy Bonus (+20 pts) — the "Golden Moment" ──────────────────────
  // Hook keyword AND a relatively long silence = attention peaked + real breath.
  // synergyGate is calibrated per-video: avg × 3 (so it's always proportional).
  if (hook.score > 0 && silenceSec >= pacing.synergyGate) score += 20;

  // 4. Pivot keyword on next segment (0–30 pts) ─────────────────────────────
  // Words like "but first", "mais avant", "now let's" explicitly signal
  // the speaker is opening a new section — the strongest placement signal.
  const pivot = pivotStrength(next.text, lang);
  if (pivot) score += pivot.score;

  // 5. Clean sentence boundary on prev (0–10 pts) ───────────────────────────
  // A segment ending in . ? ! means no mid-sentence cut — cleaner for UX.
  if (/[.?!](\s|$)/.test(prev.text.trimEnd())) score += 10;

  return {
    frameA,
    frameB,
    silenceSec,
    intensityScore: Math.min(100, Math.round(score)),
    prevTopic:      firstWords(prev.text),
    nextTopic:      firstWords(next.text),
    hookLabel:      hook.label || "energy peak",
    pivotLabel:     pivot?.label ?? "natural pause",
    wpmSpike,
    lang,
  };
}

// ─── AI prompt builder ────────────────────────────────────────────────────────

const TONE: Record<Lang, string> = { en: "Enthusiastic/English", fr: "Enthousiaste/French" };

function buildPrompt(gap: ScoredGap): string {
  const parts = [
    `Match lighting of Frame A for a seamless AI spokesperson transition.`,
    `High energy detected. Tone: ${TONE[gap.lang]}.`,
  ];
  if (gap.wpmSpike)
    parts.push("High-pacing segment — confident, energetic delivery.");
  if (gap.hookLabel === "secret reveal" || gap.hookLabel === "result reveal")
    parts.push("Viewer in high-curiosity state — open sponsor with a hook.");
  if (gap.silenceSec >= 1.5)
    parts.push("Long natural pause — smooth fade-in recommended.");
  if (gap.pivotLabel === "classic pivot" || gap.pivotLabel === "sponsor bridge")
    parts.push("Pivot phrase detected — match audio for seamless entry.");
  return parts.join(" ");
}

// ─── Video pacing profile ─────────────────────────────────────────────────────
// Computes the average silence between segments across the full transcript.
// Used to normalise silence scoring for fast-edited vs slow-paced content.
// A 0.4s gap in a hyper-edited MrBeast video is proportionally as significant
// as a 2s gap in a slow vlog — this makes scoring content-agnostic.

interface PacingProfile {
  avgSilenceSec: number;   // mean gap between consecutive segments
  silenceGate: number;     // minimum gap to count as "meaningful pause" (avg × 1.5)
  synergyGate: number;     // gap threshold for the Synergy Bonus           (avg × 3)
}

function buildPacingProfile(segments: TranscriptSegment[]): PacingProfile {
  const gaps: number[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const g = segments[i + 1].start - (segments[i].start + segments[i].duration);
    if (g > 0) gaps.push(g);
  }
  const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 1.0;

  // Relative thresholds calibrate to the video's own editing pace.
  // Ceiling (min) ensures slow/vlog content keeps the original strict gates
  // so many mediocre gaps don't all qualify for the Synergy Bonus.
  // Floor (max) ensures fast-edited content (MrBeast) still gets meaningful signals.
  //
  //  Fast video (avg ≈ 0.05s): silenceGate=0.15s, synergyGate=0.30s  ← looser
  //  Slow vlog  (avg ≈ 0.50s): silenceGate=0.50s, synergyGate=1.50s  ← original
  return {
    avgSilenceSec: avg,
    silenceGate:   Math.min(0.50, Math.max(0.15, avg * 1.5)),
    synergyGate:   Math.min(1.50, Math.max(0.30, avg * 3.0)),
  };
}

// ─── Selection ────────────────────────────────────────────────────────────────
// Scores all consecutive pairs, then picks the top N with minimum spacing.

function selectTopGaps(
  segments: TranscriptSegment[],
  topN: number,
  minSpacingSec: number,
): ScoredGap[] {
  const lang    = detectLanguage(segments);
  const total   = segments[segments.length - 1].start + segments[segments.length - 1].duration;
  const pacing  = buildPacingProfile(segments);

  const candidates: ScoredGap[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const gap = scoreGap(segments[i], segments[i + 1], total, lang, pacing);
    if (gap) candidates.push(gap);
  }

  const sorted   = [...candidates].sort((a, b) => b.intensityScore - a.intensityScore);
  const selected: ScoredGap[] = [];
  for (const gap of sorted) {
    if (selected.length === topN) break;
    if (selected.every((s) => Math.abs(s.frameA - gap.frameA) >= minSpacingSec))
      selected.push(gap);
  }

  return selected.sort((a, b) => a.frameA - b.frameA);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Returns the Top-N "Golden Integration Points" for AI sponsor injection.
 * Language (EN/FR) is auto-detected from the transcript.
 */
export function findGoldenSpots(
  segments: TranscriptSegment[],
  topN = 2,
  minSpacingSec = 45,
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
    ai_prompt_suggestion: buildPrompt(gap),
  }));
}

/** Returns PlacementWindow[] — shape consumed by the studio UI. */
export function findTopPlacements(
  segments: TranscriptSegment[],
  topN = 3,
  adDurationSeconds = 30,
  minSpacingSec = 45,
): PlacementWindow[] {
  const spots = findGoldenSpots(segments, topN, minSpacingSec);
  if (!spots.length) {
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

/** Single best placement — used directly by the studio UI. */
export function findBestPlacement(
  segments: TranscriptSegment[],
  adDurationSeconds = 30,
): PlacementWindow {
  return findTopPlacements(segments, 1, adDurationSeconds)[0];
}
