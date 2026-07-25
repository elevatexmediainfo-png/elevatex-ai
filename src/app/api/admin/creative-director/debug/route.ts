import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { analyzeUserRequest } from "@/lib/ai-os/user-understanding";
import { buildCreativeContext } from "@/lib/ai-os/creative-context";
import { buildCreativeStrategy } from "@/lib/ai-os/creative-brain";
import { runGPTCreativeDirector } from "@/lib/ai-os/creative-director";
import { buildVisualLayoutPlan } from "@/lib/ai-os/visual-layout";
import { buildTypographyPlan } from "@/lib/ai-os/typography";
import { assembleBlueprint } from "@/lib/ai-os/blueprint/engine";
import { buildVisualScenePlan } from "@/lib/ai-os/scene-planner";
import { buildPromptSpecification } from "@/lib/ai-os/prompt-spec/engine";
import { optimizePromptSpecification } from "@/lib/ai-os/prompt-optimizer";
import { translateForProvider } from "@/lib/ai-os/provider-translator";
import type { CreativeRequest } from "@/lib/ai-os/types";
import { z } from "zod";

const bodySchema = z.object({
  idea:               z.string().min(3).max(2000),
  primary_color:      z.string().optional(),
  secondary_color:    z.string().optional(),
  font_family:        z.string().optional(),
  reference_analysis: z.string().optional(),
});

// POST /api/admin/creative-director/debug
// Runs the FULL pipeline (UU → CB → GPT-CD → Blueprint → Scene → PromptSpec → Optimizer → Translator)
// and returns all 5 debug stages.
// Admin-only. No credits consumed. Not rate-limited.
export async function POST(req: Request) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("ERR_BAD_REQUEST", "Invalid JSON body.", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", parsed.error.message, 400);
  }

  const { idea, primary_color, secondary_color, font_family, reference_analysis } = parsed.data;

  // ─── Stage 0: Shared context ──────────────────────────────────────────────
  const request: CreativeRequest = {
    userId:      "admin-debug",
    rawIdea:     idea,
    requestedAt: new Date(),
  };

  const userUnderstanding = analyzeUserRequest(request);
  const context           = buildCreativeContext(request, userUnderstanding, {}, { userId: "admin-debug" });
  const strategy          = buildCreativeStrategy(context);

  const brandContext =
    primary_color || secondary_color || font_family
      ? { primaryColor: primary_color, secondaryColor: secondary_color, fontFamily: font_family }
      : undefined;

  // ─── Stage 1 (Creative Brain) ─────────────────────────────────────────────
  const creativeBrain = {
    awarenessLevel: strategy.audience.awarenessLevel.value,
    storyFlow:      strategy.campaign.storyFlow.value,
    campaignGoal:   strategy.marketing.campaignGoal.value,
    persuasion:     strategy.communication.persuasionApproach.value,
    industry:       `${strategy.business.industry.value} › ${strategy.business.subIndustry.value}`,
  };

  // ─── Stage 2 (GPT Creative Director) ─────────────────────────────────────
  const gptResult = await runGPTCreativeDirector({
    strategy,
    userUnderstanding,
    brandContext,
    referenceImageAnalysis: reference_analysis,
    rawIdea: idea,
  });

  const gptDirection = gptResult.mode === "gpt" ? gptResult.direction : undefined;

  // ─── Stage 3 (Prompt Specification) ──────────────────────────────────────
  // Build full blueprint pipeline to get a real PromptSpecification.
  const campaignPlan  = gptResult.fallbackPlan; // CampaignPlan from deterministic CD
  const layoutPlan    = buildVisualLayoutPlan(strategy, campaignPlan);
  const typographyPlan = buildTypographyPlan(strategy, campaignPlan, layoutPlan);

  const blueprint = assembleBlueprint({
    context,
    strategy,
    campaignPlan,
    layoutPlan,
    typographyPlan,
    ...(gptDirection ? { gptDirection } : {}),
  });

  const scene       = buildVisualScenePlan(blueprint);
  const promptSpec  = buildPromptSpecification(blueprint, scene, gptDirection ?? undefined);

  // ─── Stage 4 (Provider Prompt) ────────────────────────────────────────────
  const optimized     = optimizePromptSpecification(promptSpec);
  const providerPrompt = translateForProvider(optimized, "openai");

  // ─── Stage 5 (GPT Campaign Plan from deterministic CD — for reference) ────
  // (The fallbackPlan is already the CampaignPlan; expose it for the debug UI)

  return apiSuccess({
    // Existing fields for backward compatibility
    mode:         gptResult.mode,
    direction:    gptResult.direction,
    fallbackPlan: gptResult.fallbackPlan,
    debug:        gptResult.debug,

    // 5-stage pipeline for Phase 5.1 debug view
    pipeline: {
      // Stage 1 — Creative Brain
      creativeBrain,

      // Stage 2 — GPT Creative Director
      gptDirection: gptResult.direction,
      gptMode:      gptResult.mode,
      gptDebug:     gptResult.debug,

      // Stage 3 — Prompt Specification
      promptSpec: {
        meta:         promptSpec.meta,
        gptNarrative: promptSpec.gptNarrative ?? null,
        // Include the mission section for context on what the spec prioritises
        mission: {
          whatToGenerate:       promptSpec.mission.whatToGenerate.value,
          whyItMatters:         promptSpec.mission.whyItMatters.value,
          nonNegotiableElement: promptSpec.mission.nonNegotiableElement.value,
        },
      },

      // Stage 4 — Provider Prompt (OpenAI)
      providerPrompt: {
        finalPrompt:   providerPrompt.body.finalPrompt,
        tokenCount:    providerPrompt.body.estimatedTokenCount,
        promptLength:  providerPrompt.body.estimatedPromptLength,
        qualityScore:  providerPrompt.quality.estimatedQuality,
        usedNarrative: !!(promptSpec.gptNarrative && promptSpec.gptNarrative.quality.status !== "failed"),
      },

      // Stage 5 — Image (placeholder — admin can trigger a real generation via the main pipeline)
      image: null,
    },
  });
}
