import { generateScript } from "@/lib/generation/llm";
import type { LogoIntelligence } from "../../types";
import {
  logoAnalysisSchema,
  fromLlm,
  computeAssetConfidenceScore,
  collectUnknownFields,
} from "../schema";

// Phase 3 — Logo Analyzer.
// Analyzes a logo image and returns structured LogoIntelligence. The logo
// tells the system: brand colors, typography, logo type (wordmark/brandmark/
// etc.), luxury positioning, brand personality, and safe area guidance.
// This is called when a logoAssetId is available on the CreativeRequest —
// wired into the main flow in a future phase when logo upload is part of
// the enhance-prompt path.

const SYSTEM_PROMPT =
  "You are a brand identity expert. You will be shown a logo image. Analyze it and return ONLY a single JSON " +
  "object (no markdown, no prose, no code fences) with these fields: " +
  "brandColors (array of hex codes or color names found in the logo), " +
  "typography (describe the typeface style: serif, sans-serif, script, etc.), " +
  "logoType (one of: wordmark, lettermark, brandmark, combination_mark, emblem, abstract, mascot), " +
  "luxuryLevel (one of: none, low, medium, high, ultra), " +
  "visualStyle (describe the overall aesthetic in 3-5 words), " +
  "brandPersonality (describe the brand personality in 3-5 words), " +
  "preferredPlacement (one of: top_left, top_right, top_center, bottom_left, bottom_right, bottom_center, center — " +
  "where this logo looks best in a layout), " +
  "safeArea (describe the minimum clear space required around the logo, e.g. '1x the cap height on all sides'). " +
  "Never self-reference. Describe only what you observe.";

function parseJsonLoose(raw: string): unknown {
  let text = raw.trim();
  text = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  return JSON.parse(text);
}

/** Analyzes a logo from its image URL and returns LogoIntelligence. */
export async function analyzeLogo(imageUrl: string, userId: string): Promise<LogoIntelligence> {
  const result = await generateScript(
    {
      prompt: "Analyze this logo image and return the JSON object described above.",
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
    throw new Error("Logo analysis did not return valid JSON.");
  }

  const raw = logoAnalysisSchema.parse(parsed);

  const fields: Omit<LogoIntelligence, "confidenceScore" | "unknownFields"> = {
    brandColors: fromLlm(raw.brandColors, "llm_vision", "brandColors"),
    typography: fromLlm(raw.typography, "llm_vision", "typography"),
    logoType: fromLlm(raw.logoType, "llm_vision", "logoType"),
    luxuryLevel: fromLlm(raw.luxuryLevel, "llm_vision", "luxuryLevel"),
    visualStyle: fromLlm(raw.visualStyle, "llm_vision", "visualStyle"),
    brandPersonality: fromLlm(raw.brandPersonality, "llm_vision", "brandPersonality"),
    preferredPlacement: fromLlm(raw.preferredPlacement, "llm_vision", "preferredPlacement"),
    safeArea: fromLlm(raw.safeArea, "llm_vision", "safeArea"),
  };

  const confidenceScore = computeAssetConfidenceScore(fields as Record<string, ReturnType<typeof fromLlm>>);
  const unknownFields = collectUnknownFields(fields as Record<string, ReturnType<typeof fromLlm>>);

  return { ...fields, confidenceScore, unknownFields };
}
