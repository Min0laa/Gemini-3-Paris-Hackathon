// =============================================================================
// placement.ts — Perfect Entry Point Engine
//
// Scores transcript segments to find the best moments for AI ad injection.
// Targets peak-energy moments (WPM spikes, hook keywords) rather than silence.
//
// Output contract:
//   frame_a_time          → last frame of the high-energy segment (lighting reference)
//   frame_b_time          → frame_a_time + 0.1s (injection bridge)
//   ad_duration_to_inject → seconds of AI footage to insert (default 15)
// =============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────

export type Lang = "fr" | "en";

export interface TranscriptSegment {
  text: string;
  start: number;    // seconds from video start
  duration: number; // seconds
}

/** Primary output — one AI ad injection candidate */
export interface GoldenSpot {
  spot_id: string;
  timestamp: string;
  intensity_score: number;          // 0–100 — higher = more energy at this moment
  frame_a_time: number;             // seconds — last frame of the peak-energy segment
  frame_b_time: number;             // seconds — frame_a_time + 0.1 (clean bridge, injection contract)
  ad_duration_to_inject: number;    // seconds of AI ad footage to insert here (default 15)
  last_creator_words: string;       // exact words the creator said just before the cut
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
// Compiled to RegExp at module load. Add new terms to the `terms` array.

type KW = { pattern: RegExp; weight: number; label: string };

function compile(terms: string[], weight: number, label: string): KW {
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return { pattern: new RegExp(`(${escaped.join("|")})`, "i"), weight, label };
}

// Hook keywords — high-energy vocabulary (primary scoring driver, ~60% weight).
const HOOKS: Record<Lang, KW[]> = {
  en: [
    compile(["insane", "incredible", "unbelievable", "mind-blowing", "mind blowing", "unreal"], 25, "wow moment"),
    compile(["impossible", "no way", "oh my god", "oh my gosh", "what the heck"],              25, "wow moment"),
    compile(["crazy", "absolutely crazy", "this is crazy", "that's crazy"],                    22, "wow moment"),
    compile(["the secret is", "the secret to", "turns out", "the answer is"],                  22, "secret reveal"),
    compile(["look at this", "watch this", "check this out", "look at that"],                  18, "visual hook"),
    compile(["challenge", "win", "won", "lost", "survived", "eliminated", "last one"],         18, "challenge hook"),
    compile(["$100", "$1,000", "$10,000", "$100,000", "$1,000,000", "million dollars"],        25, "prize reveal"),
    compile(["subscribe", "if you subscribe", "click subscribe"],                              12, "cta hook"),
    compile(["never seen", "never done", "never been done", "first time ever", "first ever"],  18, "novelty hook"),
    compile(["world record", "guinness", "record-breaking", "largest ever", "biggest ever"],   25, "record hook"),
    compile(["literally", "honestly", "genuinely", "actually"],                                10, "emphasis"),
    compile(["you need to", "you won't believe", "trust me", "i promise"],                     15, "urgency"),
    compile(["about to", "right now", "happening right now"],                                  12, "live urgency"),
    compile(["it worked", "it actually worked", "we did it", "we won", "we lost"],             18, "result reveal"),
    compile(["doubled", "tripled", "10x", "times more", "times faster"],                       18, "metric spike"),
    compile(["completely changed", "changed my life", "game changer", "everything changed"],   22, "transformation"),
  ],
  fr: [
    compile(["incroyable", "incroyablement"],                                    25, "wow moment"),
    compile(["dingue", "fou", "folle", "ouf", "magique"],                        22, "wow moment"),
    compile(["le secret est", "le secret c'est"],                                22, "secret reveal"),
    compile(["regardez", "regardez bien", "regardez ça"],                        18, "visual hook"),
    compile(["jamais vu", "première fois", "jamais fait"],                       18, "novelty hook"),
    compile(["littéralement", "franchement", "honnêtement", "vraiment"],         10, "emphasis"),
    compile(["vous devez", "vous allez pas y croire", "croyez-moi"],             15, "urgency"),
    compile(["résultats", "ce qui s'est passé", "ça a marché", "réussi"],        15, "result reveal"),
    compile(["ça change tout", "complètement changé", "révolutionnaire"],        22, "transformation"),
    compile(["doublé", "triplé", "fois plus"],                                   18, "metric spike"),
    compile(["enfin"],                                                            12, "relief moment"),
  ],
};

// Pivot keywords — section-opener phrases in next segment (lower weight, confirms peak end).
const PIVOTS: Record<Lang, KW[]> = {
  en: [
    compile(["but first", "before we go", "before i get", "before we continue"], 20, "classic pivot"),
    compile(["speaking of", "on that note", "with that said"],                   18, "soft pivot"),
    compile(["now let's", "now i want", "now before"],                           15, "now-pivot"),
    compile(["alright", "okay so", "so anyway", "so moving on"],                 12, "section opener"),
    compile(["next up", "moving on", "let's talk", "let's move"],                10, "topic shift"),
    compile(["real quick", "quickly before", "quickly let me"],                  18, "sponsor bridge"),
  ],
  fr: [
    compile(["mais avant", "avant de continuer", "avant d'aller plus loin"],     20, "classic pivot"),
    compile(["en parlant de", "à ce propos", "dans la même veine"],              18, "soft pivot"),
    compile(["maintenant", "passons à", "passons maintenant"],                   15, "now-pivot"),
    compile(["d'ailleurs", "en fait", "du coup", "bref"],                        12, "section opener"),
    compile(["ensuite", "on passe à", "parlons de"],                             10, "topic shift"),
    compile(["rapidement", "vite fait", "juste avant"],                          18, "sponsor bridge"),
  ],
};

// ─── Language detection ───────────────────────────────────────────────────────

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
 * Cap raised to 60 if a hook keyword is paired with "!" (hype amplifier).
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

  const cap = hasKeywordHit && hasExclaim ? 60 : 50;
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

/** Last N words of a segment — used as the "creator's exact words before cut" */
function lastWords(text: string, n = 10): string {
  const words = text.trim().split(/\s+/);
  return words.slice(-n).join(" ").replace(/^[,.\s]+/, "");
}

// ─── Core segment scorer ──────────────────────────────────────────────────────
// Score = f(WPM spike, Hype Bonus, Hook Keywords, Pivot, Sentence Boundary).
// Silence is not scored — the ad is injected as new footage.

interface ScoredGap {
  frameA: number;            // end of prev segment = injection point
  frameB: number;            // frameA + 0.1s       = clean bridge (injection contract)
  intensityScore: number;    // final 0–100 score
  prevTopic: string;         // first words of prev segment (context)
  nextTopic: string;         // first words of next segment (context)
  lastCreatorWords: string;  // last words of prev segment (for AI prompt)
  hookLabel: string;
  pivotLabel: string;
  wpmSpike: boolean;
  lang: Lang;
}

const AD_DURATION_DEFAULT = 15; // seconds of AI footage to inject

function scoreSegment(
  prev: TranscriptSegment,
  next: TranscriptSegment,
  totalDuration: number,
  lang: Lang,
): ScoredGap | null {
  const frameA = prev.start + prev.duration;

  // Only score 20–75% of video length (skip intro / outro).
  const relPos = frameA / totalDuration;
  if (relPos < 0.20 || relPos > 0.75) return null;

  let score = 0;

  // 1. WPM Spike (0–35 pts) — prev segment 20%+ faster than next.
  const prevWPM  = wpm(prev);
  const nextWPM  = wpm(next);
  const wpmSpike = prevWPM > nextWPM * 1.20;
  if (wpmSpike) score += Math.min((prevWPM / (nextWPM || 1) - 1) * 70, 35);

  // 2. Hype Bonus (+20 pts) — short, fast segment = punchline.
  if (prev.duration < 2.0 && prevWPM > 120) score += 20;

  // 3. Hook keyword density (0–60 pts) — primary scoring driver.
  const hook = hookDensity(prev.text, lang);
  score += hook.score;

  // 4. Pivot keyword on next segment (0–20 pts) — confirms peak boundary.
  const pivot = pivotStrength(next.text, lang);
  if (pivot) score += pivot.score;

  // 5. Clean sentence boundary on prev (+5 pts) — avoids mid-sentence cut.
  if (/[.?!](\s|$)/.test(prev.text.trimEnd())) score += 5;

  return {
    frameA,
    frameB:           parseFloat((frameA + 0.1).toFixed(3)),
    intensityScore:   Math.min(100, Math.round(score)),
    prevTopic:        firstWords(prev.text),
    nextTopic:        firstWords(next.text),
    lastCreatorWords: lastWords(prev.text),
    hookLabel:        hook.label || "energy peak",
    pivotLabel:       pivot?.label ?? "energy cut",
    wpmSpike,
    lang,
  };
}

// ─── AI prompt builder ────────────────────────────────────────────────────────
// Builds a context-aware prompt for the AI ad generator.
// Uses the creator's last words to make the transition feel seamless.

const TONE: Record<Lang, string> = { en: "Enthusiastic/English", fr: "Enthousiaste/French" };

function buildPrompt(gap: ScoredGap): string {
  const lang   = gap.lang.toUpperCase();
  const bridge = gap.hookLabel === "secret reveal" || gap.hookLabel === "result reveal"
    ? `The creator just revealed something exciting. Open with: "And speaking of that…" or similar.`
    : gap.hookLabel === "prize reveal" || gap.hookLabel === "record hook"
    ? `The creator just hit a milestone. Open with energy matching that moment.`
    : `Use the creator's last words as a natural entry: "Just like ${gap.lastCreatorWords}…"`;

  return [
    `INJECT ${AD_DURATION_DEFAULT}s AI SPOKESPERSON AD.`,
    `Creator's last words: "${gap.lastCreatorWords}".`,
    bridge,
    `Match lighting and background of Frame A (${gap.frameA.toFixed(1)}s) exactly — color, depth, angle.`,
    `Tone: ${TONE[gap.lang]}. Language: ${lang}.`,
    gap.wpmSpike ? `High-pacing context — deliver at the same energy level, then ease into the pitch.` : "",
    gap.pivotLabel === "classic pivot" || gap.pivotLabel === "sponsor bridge"
      ? `Pivot phrase detected in next segment — mirror its transition energy.`
      : "",
  ].filter(Boolean).join(" ");
}

// ─── Selection ────────────────────────────────────────────────────────────────

function selectTopSegments(
  segments: TranscriptSegment[],
  topN: number,
  minSpacingSec: number,
): ScoredGap[] {
  const lang  = detectLanguage(segments);
  const total = segments[segments.length - 1].start + segments[segments.length - 1].duration;

  const candidates: ScoredGap[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const gap = scoreSegment(segments[i], segments[i + 1], total, lang);
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

/** Top-N injection points. Language (EN/FR) auto-detected from transcript. */
export function findGoldenSpots(
  segments: TranscriptSegment[],
  topN = 3,
  minSpacingSec = 45,
): GoldenSpot[] {
  if (segments.length < 2) return [];
  return selectTopSegments(segments, topN, minSpacingSec).map((gap, i) => ({
    spot_id:               `sponsor_${i + 1}`,
    timestamp:             formatTimestamp(gap.frameA),
    intensity_score:       gap.intensityScore,
    frame_a_time:          parseFloat(gap.frameA.toFixed(3)),
    frame_b_time:          gap.frameB,
    ad_duration_to_inject: AD_DURATION_DEFAULT,
    last_creator_words:    gap.lastCreatorWords,
    context:               `Transition from "${gap.prevTopic}" → "${gap.nextTopic}"`,
    language:              gap.lang,
    ai_prompt_suggestion:  buildPrompt(gap),
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
