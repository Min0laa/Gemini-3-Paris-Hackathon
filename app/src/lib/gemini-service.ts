// ─────────────────────────────────────────────────────────────────────────────
// gemini-service.ts — Placeholder for Gemini API semantic validation
//
// Currently: passes the local intensity score through unchanged (mock mode).
// Later:     replace the TODO block with a real Gemini API call that receives
//            the transcript context and returns a refined confidence score.
// ─────────────────────────────────────────────────────────────────────────────

export interface GeminiValidationInput {
  prevText: string;   // transcript text of the high-energy segment
  nextText: string;   // transcript text of the new section
  localScore: number; // 0–100 score from the local scoring engine
  language: "fr" | "en";
}

export interface GeminiValidationResult {
  validatedScore: number;  // 0–100, refined score after Gemini analysis
  confidence: number;      // 0–1, how certain Gemini is about this spot
  reasoning: string;       // human-readable explanation from Gemini
  geminiUsed: boolean;     // false = mock mode, true = real API call
}

/**
 * Validates a Golden Spot candidate with the Gemini API.
 *
 * MOCK MODE (current): passes the local score through with a placeholder
 * reasoning string so the rest of the pipeline can be tested end-to-end.
 *
 * PRODUCTION MODE (future): uncomment the TODO block and inject your
 * Gemini API key via environment variable GEMINI_API_KEY.
 */
export async function validateSpotWithGemini(
  input: GeminiValidationInput,
): Promise<GeminiValidationResult> {

  // TODO: Inject Gemini API call here later
  //
  // import { GoogleGenerativeAI } from "@google/generative-ai";
  //
  // const genAI  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  // const model  = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  //
  // const prompt = `
  //   You are an expert YouTube ad placement analyst.
  //   Language: ${input.language.toUpperCase()}
  //
  //   A local scoring engine gave this transition a score of ${input.localScore}/100.
  //
  //   Segment ending here (high-energy):
  //   "${input.prevText}"
  //
  //   Segment starting here (new section):
  //   "${input.nextText}"
  //
  //   Tasks:
  //   1. Is this a natural, non-disruptive spot for a 30-second sponsor message? (yes/no)
  //   2. Rate the placement quality from 0 to 100.
  //   3. Explain your reasoning in one sentence.
  //
  //   Respond in JSON: { "score": number, "confidence": number, "reasoning": string }
  // `;
  //
  // const result = await model.generateContent(prompt);
  // const json   = JSON.parse(result.response.text());
  // return { validatedScore: json.score, confidence: json.confidence, reasoning: json.reasoning, geminiUsed: true };

  // ── Mock response — remove once the TODO block above is active ────────────
  return {
    validatedScore: input.localScore,
    confidence:     0,
    reasoning:      "[Mock] Gemini validation not yet active — local score passed through.",
    geminiUsed:     false,
  };
}
