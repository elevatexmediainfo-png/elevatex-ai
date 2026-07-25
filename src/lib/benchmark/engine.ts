// Phase 6 — Benchmark Engine.
//
// Orchestrates the Image Benchmark & Prompt Lab: runs the GPT Creative Director,
// builds all 4 prompt variants, stores sessions in the DB, and generates images
// using the existing generation infrastructure.
//
// FROZEN: No AI modules, generation providers, or translators are modified here.
// This module is a NEW consumer of existing infrastructure — not a modification.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { analyzeUserRequest } from "@/lib/ai-os/user-understanding";
import { buildCreativeContext } from "@/lib/ai-os/creative-context";
import { buildCreativeStrategy } from "@/lib/ai-os/creative-brain";
import { runGPTCreativeDirector } from "@/lib/ai-os/creative-director";
import { assembleBlueprint } from "@/lib/ai-os/blueprint/engine";
import { buildVisualLayoutPlan } from "@/lib/ai-os/visual-layout";
import { buildTypographyPlan } from "@/lib/ai-os/typography";
import { buildVisualScenePlan } from "@/lib/ai-os/scene-planner";
import { buildPromptSpecification } from "@/lib/ai-os/prompt-spec/engine";
import { optimizePromptSpecification } from "@/lib/ai-os/prompt-optimizer";
import { getRenderingDirective } from "@/lib/ai-os/provider-translator/shared/section-builders";
import { OPENAI_QUALITY_SENTENCE, OPENAI_QUALITY_ANTI_PATTERNS, OPENAI_LIMITS } from "@/lib/ai-os/provider-translator/providers/openai/quality";
import { buildAllVariants } from "@/lib/ai-os/prompt-variants";
import { runDesignIntelligenceLayer, DESIGN_INTELLIGENCE_LAYER_ENABLED } from "@/lib/ai-os/design-layer";
import { generateImage } from "@/lib/generation/image";
import type { CreativeRequest, BrandContext } from "@/lib/ai-os/types";
import type { BenchmarkFull, BenchmarkSummary, BestPerformer, RatingData, VariantSummary } from "./types";
import type { VariantType } from "@/lib/ai-os/prompt-variants";
import { VARIANT_FOCUS } from "@/lib/ai-os/prompt-variants";

// ─── Token estimation (same formula as the translator) ───────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Append quality suffix consistent with the OpenAI translator ─────────────

function appendQualitySuffix(narrative: string, renderingDirective: string): string {
  let prompt = narrative;
  prompt += renderingDirective
    ? ` ${OPENAI_QUALITY_SENTENCE} ${renderingDirective}.`
    : ` ${OPENAI_QUALITY_SENTENCE}`;
  prompt += ` Avoid: ${OPENAI_QUALITY_ANTI_PATTERNS.join(", ")}.`;
  if (prompt.length > OPENAI_LIMITS.maxLength) {
    prompt = prompt.slice(0, OPENAI_LIMITS.maxLength - 3) + "...";
  }
  return prompt;
}

// ─── DB → VariantSummary ─────────────────────────────────────────────────────

function toVariantSummary(v: {
  id: string;
  variantType: string;
  variantLabel: string;
  finalPrompt: string;
  promptLength: number;
  tokenCount: number;
  status: string;
  imageUrl: string | null;
  executionMs: number | null;
  provider: string | null;
  generatedAt: Date | null;
  errorMessage: string | null;
  rating: {
    commercialAppeal: number;
    storytelling: number;
    composition: number;
    realism: number;
    premiumFeel: number;
    scrollStopping: number;
    brandFit: number;
    marketingEffectiveness: number;
    overallScore: number;
    notes: string | null;
  } | null;
}): VariantSummary {
  return {
    id:           v.id,
    variantType:  v.variantType as VariantType,
    variantLabel: v.variantLabel,
    focus:        VARIANT_FOCUS[v.variantType as VariantType] ?? "",
    finalPrompt:  v.finalPrompt,
    promptLength: v.promptLength,
    tokenCount:   v.tokenCount,
    status:       v.status as VariantSummary["status"],
    imageUrl:     v.imageUrl,
    executionMs:  v.executionMs,
    provider:     v.provider,
    generatedAt:  v.generatedAt?.toISOString() ?? null,
    errorMessage: v.errorMessage,
    rating:       v.rating ? {
      commercialAppeal:       v.rating.commercialAppeal,
      storytelling:           v.rating.storytelling,
      composition:            v.rating.composition,
      realism:                v.rating.realism,
      premiumFeel:            v.rating.premiumFeel,
      scrollStopping:         v.rating.scrollStopping,
      brandFit:               v.rating.brandFit,
      marketingEffectiveness: v.rating.marketingEffectiveness,
      overallScore:           v.rating.overallScore,
      notes:                  v.rating.notes ?? undefined,
    } : null,
  };
}

const VARIANT_INCLUDE = {
  rating: {
    select: {
      commercialAppeal: true, storytelling: true, composition: true,
      realism: true, premiumFeel: true, scrollStopping: true,
      brandFit: true, marketingEffectiveness: true, overallScore: true, notes: true,
    },
  },
} as const;

// ─── createBenchmarkSession ───────────────────────────────────────────────────

export async function createBenchmarkSession(params: {
  rawIdea:                string;
  userId:                 string;
  brandContext?:          BrandContext;
  referenceImageAnalysis?: string;
}): Promise<{ benchmarkId: string; variants: VariantSummary[] }> {
  const { rawIdea, userId, brandContext, referenceImageAnalysis } = params;

  // Stage 1 — Creative Brain (deterministic)
  const request: CreativeRequest = { userId, rawIdea, requestedAt: new Date() };
  const userUnderstanding = analyzeUserRequest(request);
  const context  = buildCreativeContext(request, userUnderstanding, {}, { userId });
  const strategy = buildCreativeStrategy(context);

  // Stage 2 — GPT Creative Director
  const gptResult = await runGPTCreativeDirector({
    strategy, userUnderstanding, brandContext, referenceImageAnalysis, rawIdea,
  });

  if (gptResult.mode !== "gpt" || !gptResult.direction) {
    throw new Error(
      "GPT Creative Director is required for variant benchmarking. " +
      "GPT mode is unavailable — check your OpenAI provider configuration."
    );
  }

  const gptDirection = gptResult.direction;
  const industry     = strategy.business.industry.value;

  // Stage 3 — Full pipeline to get rendering directive (for consistent quality suffix)
  const campaignPlan   = gptResult.fallbackPlan;
  const layoutPlan     = buildVisualLayoutPlan(strategy, campaignPlan);
  const typographyPlan = buildTypographyPlan(strategy, campaignPlan, layoutPlan);
  const blueprint      = assembleBlueprint({ context, strategy, campaignPlan, layoutPlan, typographyPlan });
  const scene          = buildVisualScenePlan(blueprint);
  const spec           = buildPromptSpecification(blueprint, scene, gptDirection);
  const optimized      = optimizePromptSpecification(spec);
  const renderingDirective = getRenderingDirective(optimized);

  // Stage 4 — Build all 4 variant narratives from the same GPT direction.
  // Phase 8.2: when DIL is enabled, Variant A ("balanced") uses the Design
  // Intelligence Layer's compiledPrompt instead of buildNarrativePrompt().
  // Variants B/C/D are unchanged — they reorder the same GPT fields and exist
  // to test whether field ORDER affects image quality, independent of DIL.
  const builtVariants = (() => {
    const base = buildAllVariants(gptDirection);
    if (!DESIGN_INTELLIGENCE_LAYER_ENABLED) return base;
    const dilResult = runDesignIntelligenceLayer({ gptDirection, strategy });
    return base.map(v =>
      v.type === "balanced" ? { ...v, narrative: dilResult.compiledPrompt } : v
    );
  })();

  // Stage 5 — Append quality suffix to each variant (consistent with production translator)
  const variantRecords = builtVariants.map(v => {
    const finalPrompt = appendQualitySuffix(v.narrative, renderingDirective);
    return {
      variantType:  v.type,
      variantLabel: v.label,
      finalPrompt,
      promptLength: finalPrompt.length,
      tokenCount:   estimateTokens(finalPrompt),
    };
  });

  // Stage 6 — Persist to DB (create then fetch to get stable typed includes)
  const { id: benchmarkId } = await prisma.promptBenchmark.create({
    data: {
      userId,
      rawIdea,
      industry,
      gptMode:      "gpt",
      gptDirection: gptDirection as unknown as Prisma.InputJsonValue,
      variants: {
        create: variantRecords,
      },
    },
    select: { id: true },
  });

  const benchmark = await prisma.promptBenchmark.findFirst({
    where:   { id: benchmarkId },
    include: { variants: { include: VARIANT_INCLUDE, orderBy: { createdAt: "asc" } } },
  });
  if (!benchmark) throw new Error("Failed to retrieve benchmark after creation.");

  return {
    benchmarkId: benchmark.id,
    variants:    benchmark.variants.map(toVariantSummary),
  };
}

// ─── generateVariantImage ─────────────────────────────────────────────────────

export async function generateVariantImage(params: {
  variantId:   string;
  userId:      string;
  aspectRatio: "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";
}): Promise<VariantSummary> {
  const { variantId, userId, aspectRatio } = params;

  const variant = await prisma.promptBenchmarkVariant.findFirst({
    where: { id: variantId, benchmark: { userId } },
    include: VARIANT_INCLUDE,
  });
  if (!variant) throw new Error("Variant not found.");
  if (variant.status === "generating") throw new Error("Image generation already in progress.");

  // Mark as generating
  await prisma.promptBenchmarkVariant.update({
    where: { id: variantId },
    data:  { status: "generating", errorMessage: null },
  });

  try {
    const start  = Date.now();
    const result = await generateImage(
      { prompt: variant.finalPrompt, aspectRatio },
      "creative_image",
      { userId },
    );
    const executionMs = Date.now() - start;

    // Fixed (2026-07-24) — this used to hardcode "openai_images" as the
    // provider regardless of which one actually served the result,
    // discovered while auditing every generateImage() call site for a
    // real mock-fallback gap. Prompt Lab is an internal admin tool (not a
    // user-facing content pipeline), so a hard-fail-on-mock guard would
    // work against its actual purpose — an admin comparing providers may
    // legitimately want to see what Mock produces too. The honest fix here
    // is transparency: show the REAL provider (including "mock" when it
    // fires) instead of a wrong, hardcoded label that hid it either way.
    const updated = await prisma.promptBenchmarkVariant.update({
      where: { id: variantId },
      data: {
        status:      "generated",
        imageUrl:    result.imageUrl,
        executionMs,
        provider:    result.providerId,
        generatedAt: new Date(),
        errorMessage: null,
      },
      include: VARIANT_INCLUDE,
    });

    return toVariantSummary(updated);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Image generation failed.";
    const updated = await prisma.promptBenchmarkVariant.update({
      where: { id: variantId },
      data:  { status: "failed", errorMessage },
      include: VARIANT_INCLUDE,
    });
    return toVariantSummary(updated);
  }
}

// ─── saveVariantRating ────────────────────────────────────────────────────────

export async function saveVariantRating(params: {
  variantId: string;
  userId:    string;
  rating:    RatingData;
}): Promise<void> {
  const { variantId, userId, rating } = params;

  const variant = await prisma.promptBenchmarkVariant.findFirst({
    where: { id: variantId, benchmark: { userId } },
  });
  if (!variant) throw new Error("Variant not found.");

  await prisma.promptBenchmarkRating.upsert({
    where:  { variantId },
    create: { variantId, ...rating },
    update: { ...rating, ratedAt: new Date() },
  });
}

// ─── markBenchmarkWinner ──────────────────────────────────────────────────────

export async function markBenchmarkWinner(params: {
  benchmarkId: string;
  variantId:   string;
  userId:      string;
}): Promise<void> {
  const { benchmarkId, variantId, userId } = params;

  const benchmark = await prisma.promptBenchmark.findFirst({
    where: { id: benchmarkId, userId },
  });
  if (!benchmark) throw new Error("Benchmark not found.");

  const variant = await prisma.promptBenchmarkVariant.findFirst({
    where: { id: variantId, benchmarkId },
  });
  if (!variant) throw new Error("Variant does not belong to this benchmark.");

  await prisma.promptBenchmark.update({
    where: { id: benchmarkId },
    data:  { winnerId: variantId },
  });
}

// ─── getBenchmark ─────────────────────────────────────────────────────────────

export async function getBenchmark(params: {
  id:     string;
  userId: string;
}): Promise<BenchmarkFull | null> {
  const row = await prisma.promptBenchmark.findFirst({
    where:   { id: params.id, userId: params.userId },
    include: { variants: { include: VARIANT_INCLUDE, orderBy: { createdAt: "asc" } } },
  });
  if (!row) return null;

  return {
    id:           row.id,
    rawIdea:      row.rawIdea,
    industry:     row.industry,
    gptMode:      row.gptMode as "gpt" | "fallback",
    gptDirection: row.gptDirection as Record<string, unknown> | null,
    winnerId:     row.winnerId,
    createdAt:    row.createdAt.toISOString(),
    variants:     row.variants.map(toVariantSummary),
  };
}

// ─── getBenchmarkHistory ──────────────────────────────────────────────────────

export async function getBenchmarkHistory(params: {
  userId: string;
  limit?: number;
}): Promise<{ history: BenchmarkSummary[]; bestPerformers: BestPerformer[] }> {
  const limit = params.limit ?? 20;

  const [rows, topRated] = await Promise.all([
    prisma.promptBenchmark.findMany({
      where:   { userId: params.userId },
      orderBy: { createdAt: "desc" },
      take:    limit,
      include: {
        variants: {
          select: {
            id: true,
            status: true,
            rating: { select: { overallScore: true } },
          },
        },
      },
    }),
    // Top 10 rated variants across all benchmarks for this user
    prisma.promptBenchmarkRating.findMany({
      where:   { variant: { benchmark: { userId: params.userId } } },
      orderBy: { overallScore: "desc" },
      take:    10,
      include: {
        variant: {
          select: {
            id: true, variantLabel: true, finalPrompt: true, imageUrl: true,
            benchmark: { select: { id: true, rawIdea: true } },
          },
        },
      },
    }),
  ]);

  const history: BenchmarkSummary[] = rows.map(r => ({
    id:             r.id,
    rawIdea:        r.rawIdea,
    industry:       r.industry,
    gptMode:        r.gptMode,
    winnerId:       r.winnerId,
    createdAt:      r.createdAt.toISOString(),
    variantCount:   r.variants.length,
    generatedCount: r.variants.filter(v => v.status === "generated").length,
    ratedCount:     r.variants.filter(v => v.rating !== null).length,
  }));

  const bestPerformers: BestPerformer[] = topRated.map(r => ({
    variantId:    r.variant.id,
    benchmarkId:  r.variant.benchmark.id,
    rawIdea:      r.variant.benchmark.rawIdea,
    variantLabel: r.variant.variantLabel,
    finalPrompt:  r.variant.finalPrompt,
    imageUrl:     r.variant.imageUrl,
    score:        r.overallScore,
    ratedAt:      r.ratedAt.toISOString(),
  }));

  return { history, bestPerformers };
}
