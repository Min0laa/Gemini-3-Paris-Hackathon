// =============================================================================
// gemini-service.ts — Gemini API integration point
//
// Currently mock: returns local score unchanged.
// To activate: set GEMINI_API_KEY in .env and implement the TODO block.
// =============================================================================

export interface AdSpotContext {
  video_id: string;
  frame_a_time: number;   // seconds — last frame of high-energy segment
  frame_b_time: number;   // seconds — first frame of new section
  prev_text: string;      // transcript text just before frame_a (the hook)
  next_text: string;      // transcript text just after frame_b (new section)
  local_score: number;    // 0–100 score from the local engine
  language: "fr" | "en";
}

export interface AdGenerationResult {
  validated_score: number;    // 0–100, Gemini-refined score
  confidence: number;         // 0–1
  ai_generation_prompt: string; // prompt your teammate feeds into the AI ad generator
  gemini_active: boolean;     // false = mock, true = real API
}

export async function validateAndGenerateAd(
  ctx: AdSpotContext,
): Promise<AdGenerationResult> {

  // ── TODO: Replace this block with the real Gemini API call ────────────────
  //
  // import { GoogleGenerativeAI } from "@google/generative-ai";
  // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  // const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  //
  // const result = await model.generateContent(`
  //   You are an expert at seamless AI-generated video ad insertion.
  //   Language: ${ctx.language.toUpperCase()}
  //   Local score: ${ctx.local_score}/100
  //
  //   Frame A (${ctx.frame_a_time}s) — end of high-energy segment:
  //   "${ctx.prev_text}"
  //
  //   Frame B (${ctx.frame_b_time}s) — start of new section:
  //   "${ctx.next_text}"
  //
  //   1. Confirm this is a valid non-disruptive insertion point (yes/no).
  //   2. Rate placement quality 0–100.
  //   3. Write a one-sentence AI spokesperson generation prompt that matches
  //      the lighting, background, and energy of Frame A so the ad is seamless.
  //
  //   JSON: { "score": number, "confidence": number, "prompt": string }
  // `);
  // const json = JSON.parse(result.response.text());
  // return { validated_score: json.score, confidence: json.confidence,
  //          ai_generation_prompt: json.prompt, gemini_active: true };
  // ─────────────────────────────────────────────────────────────────────────

  // Mock: pass local score through, generate a static prompt from existing context
  return {
    validated_score:      ctx.local_score,
    confidence:           0,
    ai_generation_prompt: `Match the lighting and background of Frame A at ${ctx.frame_a_time}s. ` +
                          `Seamlessly insert a 5–10s AI spokesperson ad in ${ctx.language.toUpperCase()} ` +
                          `between frame_a (${ctx.frame_a_time}s) and frame_b (${ctx.frame_b_time}s). ` +
                          `The previous content was: "${ctx.prev_text.slice(0, 80)}".`,
    gemini_active:        false,
  };
}
