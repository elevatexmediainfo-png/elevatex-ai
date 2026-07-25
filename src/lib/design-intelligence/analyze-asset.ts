import { generateScript } from "@/lib/generation/llm";
import { assetAnalysisSchema, splitAssetAnalysis, type AssetAnalysisResult } from "./schema";

// Milestone 16 — supersedes lib/creative/reference-analysis.ts's free-text
// analyzeReferenceImage(). Same vision-LLM call, but the model is asked for
// one structured JSON object instead of a 500-600 word paragraph — this IS
// the Design Intelligence Library's analysis step: every uploaded reference
// image gets a real, queryable, field-by-field breakdown, not prose.
const SYSTEM_PROMPT =
  "You are a professional creative director and photography/design analyst. You will be shown a reference " +
  "image — it may be a style reference, a product photo, or any visual the user wants the generation to learn " +
  "from. Analyze it and return ONLY a single JSON object (no markdown, no prose, no code fences) with these " +
  "string fields, every one optional but fill in as many as you can confidently judge from the image: " +
  "industry, category, style, mood, platform, lighting, composition, typography, camera, lens, perspective, " +
  "depth, texture, hierarchy, whiteSpace, luxuryLevel, modernLevel, minimalism, contrast, visualBalance, " +
  "aspectRatio, headlinePosition, ctaPosition, logoPosition, marketingGoal, marketingFeel, targetAudience, " +
  "visualLanguage — plus colorPalette and objects as JSON arrays of short strings. Each string value should be " +
  "a concrete, reusable description of the technique (e.g. lighting: \"soft diffused key light from upper-left " +
  "with a subtle rim light\"), never \"similar to the reference\" or other self-referential phrasing — describe " +
  "the visual language itself, never an instruction to copy or recreate the image.";

function parseJsonLoose(raw: string): unknown {
  let text = raw.trim();
  text = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  return JSON.parse(text);
}

export async function analyzeAssetForLibrary(imageUrl: string, userId: string): Promise<AssetAnalysisResult> {
  const result = await generateScript(
    {
      prompt: "Analyze this reference image and return the JSON object described above.",
      contentLanguage: "EN",
      systemPrompt: SYSTEM_PROMPT,
      imageUrl,
      responseFormat: "json",
    },
    { userId },
    "design_intelligence_analysis"
  );

  let parsed: unknown;
  try {
    parsed = parseJsonLoose(result.text);
  } catch {
    throw new Error("Reference image analysis did not return valid JSON.");
  }

  return assetAnalysisSchema.parse(parsed);
}

export { splitAssetAnalysis };
