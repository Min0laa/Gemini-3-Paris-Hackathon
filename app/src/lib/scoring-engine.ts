// ─────────────────────────────────────────────────────────────────────────────
// scoring-engine.ts — Language detection + gap scoring logic
//
// Consumed exclusively by placement.ts. Do not import directly elsewhere.
// ─────────────────────────────────────────────────────────────────────────────

import { HOOKS, PIVOTS, type Lang } from "./keywords";
import type { TranscriptSegment } from "./placement";

// ── Language detection ────────────────────────────────────────────────────────

const EN_MARKERS = /\b(the|and|is|are|was|were|this|that|with|for|you|have|been|they)\b/gi;
const FR_MARKERS = /\b(le|la|les|un|une|des|est|sont|avec|pour|vous|nous|ils|elles|que|qui|dans|sur)\b/gi;

export function detectLanguage(segments: TranscriptSegment[]): Lang {
  const text    = segments.map((s) => s.text).join(" ").toLowerCase();
  const enCount = (text.match(EN_MARKERS) ?? []).length;
  const frCount = (text.match(FR_MARKERS) ?? []).length;
  return frCount > enCount ? "fr" : "en";
}

// ── Signal helpers ────────────────────────────────────────────────────────────

function wpm(seg: TranscriptSegment): number {
  return seg.text.trim().split(/\s+/).length / ((seg.duration || 1) / 60);
}

function hookDensity(text: string, lang: Lang): { score: number; labels: string[] } {
  let score = 0;
  const labels: string[] = [];
  if (/!/.test(text)) { score += 5; labels.push("exclamation"); }
  for (const { pattern, weight, label } of HOOKS[lang]) {
    if (pattern.test(text)) { score += weight; labels.push(label); }
  }
  return { score: Math.min(score, 40), labels };
}

function pivotStrength(text: string, lang: Lang): { score: number; label: string } | null {
  for (const { pattern, weight, label } of PIVOTS[lang]) {
    if (pattern.test(text.trim())) return { score: weight, label };
  }
  return null;
}

export function topicSummary(text: string): string {
  return text.trim().split(/\s+/).slice(0, 6).join(" ").replace(/[,.]$/, "");
}

// ── Scored gap type ───────────────────────────────────────────────────────────

export interface ScoredGap {
  frameA: number;
  frameB: number;
  silenceSec: number;
  intensityScore: number;
  prevTopic: string;
  nextTopic: string;
  dominantLabel: string;
  wpmSpike: boolean;
  pivotLabel: string;
  lang: Lang;
}

// ── Core scoring — one gap between segment[i] and segment[i+1] ───────────────

export function scoreTransition(
  prev: TranscriptSegment,
  next: TranscriptSegment,
  totalDuration: number,
  lang: Lang,
): ScoredGap | null {
  const frameA     = prev.start + prev.duration;
  const frameB     = next.start;
  const silenceSec = Math.max(0, frameB - frameA);

  // Hard filter: safety zone 20%–70% of video
  const relPos = frameA / totalDuration;
  if (relPos < 0.20 || relPos > 0.70) return null;

  let score = 0;

  // 1. WPM spike — language-agnostic primary driver (0–25 pts)
  const prevWPM  = wpm(prev);
  const nextWPM  = wpm(next);
  const wpmSpike = prevWPM > nextWPM * 1.20;
  if (wpmSpike) score += Math.min((prevWPM / (nextWPM || 1) - 1) * 50, 25);

  // 2. Hook keyword density on prev segment (0–40 pts)
  const { score: hookScore, labels: hookLabels } = hookDensity(prev.text, lang);
  score += hookScore;

  // 3. Silence gap > 0.8s after spike (0–20 pts)
  if (silenceSec >= 0.8) score += Math.min(20, silenceSec * 8);

  // 4. Pivot keyword on next segment (0–30 pts)
  const pivot = pivotStrength(next.text, lang);
  if (pivot) score += pivot.score;

  // 5. Clean sentence boundary on prev (0–10 pts)
  if (/[.?!](\s|$)/.test(prev.text.trimEnd())) score += 10;

  return {
    frameA,
    frameB,
    silenceSec,
    intensityScore: Math.min(100, Math.round(score)),
    prevTopic:      topicSummary(prev.text),
    nextTopic:      topicSummary(next.text),
    dominantLabel:  hookLabels[0] ?? "energy peak",
    wpmSpike,
    pivotLabel:     pivot?.label ?? "natural pause",
    lang,
  };
}

// ── AI prompt builder ─────────────────────────────────────────────────────────

const TONE: Record<Lang, string> = {
  en: "Enthusiastic/English",
  fr: "Enthousiaste/French",
};

export function buildAIPrompt(gap: ScoredGap): string {
  const parts = [
    `Match lighting of Frame A for a seamless AI spokesperson transition.`,
    `High energy detected. Tone: ${TONE[gap.lang]}.`,
  ];
  if (gap.wpmSpike)
    parts.push("High-pacing segment — confident, energetic delivery.");
  if (gap.dominantLabel === "secret reveal" || gap.dominantLabel === "result reveal")
    parts.push("Viewer in high-curiosity state — open sponsor with a hook.");
  if (gap.silenceSec >= 1.5)
    parts.push("Long natural pause — smooth fade-in recommended.");
  if (gap.pivotLabel === "classic pivot" || gap.pivotLabel === "sponsor bridge")
    parts.push("Pivot phrase detected — audio match for seamless entry.");
  return parts.join(" ");
}
