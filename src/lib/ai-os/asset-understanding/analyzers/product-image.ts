import { generateScript } from "@/lib/generation/llm";
import type { ProductImageIntelligence } from "../../types";
import {
  productAnalysisSchema,
  fromLlm,
  computeAssetConfidenceScore,
  collectUnknownFields,
} from "../schema";

// Phase 3 — Product Image Analyzer.
// Analyzes a product image and returns structured ProductImageIntelligence
// covering material, packaging, presentation style, suitable camera angles,
// and marketing suitability — inputs that future generation phases will use
// to produce product-matched creative compositions.

const SYSTEM_PROMPT =
  "You are a product photography expert and commercial creative director. You will be shown a product image. " +
  "Analyze it and return ONLY a single JSON object (no markdown, no prose, no code fences) with these fields: " +
  "productCategory (e.g. skincare, food, electronics, jewellery, clothing), " +
  "primaryProduct (describe the main product in the image), " +
  "secondaryObjects (array: other objects present in the scene), " +
  "material (dominant material: glass, plastic, metal, fabric, ceramic, etc.), " +
  "texture (surface texture description), " +
  "packaging (one of: none, box, bottle, bag, tube, pouch, jar, can, blister, other), " +
  "reflection (one of: none, subtle, moderate, strong), " +
  "shadow (one of: none, soft, hard, cast, drop_shadow), " +
  "surface (what surface the product is on), " +
  "scale (one of: macro, close_up, medium, full_product, in_context), " +
  "heroAngle (the angle from which the product is currently photographed), " +
  "suitableCameraAngle (best camera angle for marketing this product), " +
  "suitableLighting (best lighting setup for this product type), " +
  "backgroundRecommendation (recommended background style for this product), " +
  "bestPresentationStyle (how this product should be presented — on-model, flat-lay, lifestyle, studio), " +
  "marketingSuitability (what advertising formats this product works best for). " +
  "Never self-reference. Describe only what you observe.";

function parseJsonLoose(raw: string): unknown {
  let text = raw.trim();
  text = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  return JSON.parse(text);
}

/** Analyzes a product image from its URL and returns ProductImageIntelligence. */
export async function analyzeProductImage(imageUrl: string, userId: string): Promise<ProductImageIntelligence> {
  const result = await generateScript(
    {
      prompt: "Analyze this product image and return the JSON object described above.",
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
    throw new Error("Product image analysis did not return valid JSON.");
  }

  const raw = productAnalysisSchema.parse(parsed);

  const fields: Omit<ProductImageIntelligence, "confidenceScore" | "unknownFields"> = {
    productCategory: fromLlm(raw.productCategory, "llm_vision", "productCategory"),
    primaryProduct: fromLlm(raw.primaryProduct, "llm_vision", "primaryProduct"),
    secondaryObjects: fromLlm(raw.secondaryObjects, "llm_vision", "secondaryObjects"),
    material: fromLlm(raw.material, "llm_vision", "material"),
    texture: fromLlm(raw.texture, "llm_vision", "texture"),
    packaging: fromLlm(raw.packaging, "llm_vision", "packaging"),
    reflection: fromLlm(raw.reflection, "llm_vision", "reflection"),
    shadow: fromLlm(raw.shadow, "llm_vision", "shadow"),
    surface: fromLlm(raw.surface, "llm_vision", "surface"),
    scale: fromLlm(raw.scale, "llm_vision", "scale"),
    heroAngle: fromLlm(raw.heroAngle, "llm_vision", "heroAngle"),
    suitableCameraAngle: fromLlm(raw.suitableCameraAngle, "llm_vision", "suitableCameraAngle"),
    suitableLighting: fromLlm(raw.suitableLighting, "llm_vision", "suitableLighting"),
    backgroundRecommendation: fromLlm(raw.backgroundRecommendation, "llm_vision", "backgroundRecommendation"),
    bestPresentationStyle: fromLlm(raw.bestPresentationStyle, "llm_vision", "bestPresentationStyle"),
    marketingSuitability: fromLlm(raw.marketingSuitability, "llm_vision", "marketingSuitability"),
  };

  const confidenceScore = computeAssetConfidenceScore(fields as Record<string, ReturnType<typeof fromLlm>>);
  const unknownFields = collectUnknownFields(fields as Record<string, ReturnType<typeof fromLlm>>);

  return { ...fields, confidenceScore, unknownFields };
}
