import { NextRequest } from "next/server";

import { newTraceId, traceStep } from "@/lib/observability/production-trace";
import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { PRESETS_BY_KIND } from "@/lib/validations/creative";
import { buildUniversalPromptFromIdea, cleanEnhancedPrompt } from "@/lib/prompt-os/builder";
import { buildCreativeBrief } from "@/lib/prompt-os/creative-director";
import { expandUniversalPrompt } from "@/lib/prompt-os/prompt-expander";
import { resolveKindAndPreset, DEFAULT_PRESET_BY_KIND } from "@/lib/prompt-os/resolve-kind";
import { resolvePromptAdapter } from "@/lib/prompt-os/adapters";
import { TOOL_KEY_BY_KIND } from "@/lib/creative/engine";
import { listEnabledProviderConfigs } from "@/lib/providers/credentials";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";

// AI OS modules
import { buildEnhancePromptRequest } from "@/lib/ai-os/request-manager";
import { analyzeUserRequest } from "@/lib/ai-os/user-understanding";
import { resolveAssetIntelligence, AssetNotFoundError } from "@/lib/ai-os/asset-understanding";
import { AllProvidersFailedError, describeAllProvidersFailure } from "@/lib/generation/types";
import { buildCreativeContext, buildPromptOsInput } from "@/lib/ai-os/creative-context";
import { buildCreativeStrategy } from "@/lib/ai-os/creative-brain";
import { buildCampaignPlan } from "@/lib/ai-os/creative-director";
import { buildVisualLayoutPlan } from "@/lib/ai-os/visual-layout";
import { buildTypographyPlan } from "@/lib/ai-os/typography";
import { assembleBlueprint } from "@/lib/ai-os/blueprint";
import { buildVisualScenePlan } from "@/lib/ai-os/scene-planner";
import { buildSceneGraph } from "@/lib/ai-os/scene-graph";
import { buildPromptSpecification } from "@/lib/ai-os/prompt-spec";
import { compileToVisualLanguage, applyCompiledPrompt } from "@/lib/ai-os/prompt-compiler";
import { optimizePromptSpecification } from "@/lib/ai-os/prompt-optimizer";
import { translateForProvider, resolveProviderForTranslation } from "@/lib/ai-os/provider-translator";
import type { ProviderPrompt, SupportedProvider } from "@/lib/ai-os/provider-translator";
import type { PromptSpecification } from "@/lib/ai-os/prompt-spec";
import type { OptimizedPromptSpecification } from "@/lib/ai-os/prompt-optimizer";
import type { UniversalCampaignBlueprint } from "@/lib/ai-os/blueprint";
import type { VisualScenePlan } from "@/lib/ai-os/scene-planner";
import type { SceneGraph } from "@/lib/ai-os/scene-graph";
import type { CompiledPrompt } from "@/lib/ai-os/prompt-compiler";
import {
  ExecutionTreeBuilder, timed, buildProviderReport, buildInfluenceGraph,
  buildRuntimeReport, assembleFinalReport, detectSceneGraphConsumption,
} from "@/lib/ai-os/runtime-trace";
import type { RuntimeVerificationReport } from "@/lib/ai-os/runtime-trace";
import type { VisualLayoutPlan } from "@/lib/ai-os/visual-layout";
import type { TypographyPlan } from "@/lib/ai-os/typography";
import {
  evaluateIntelligence, buildRouteContext, applyRouteToScene,
  DEFAULT_EXPLORATION_CONFIG, buildEmptyFingerprint, buildMemoryEntry,
} from "@/lib/ai-os/creative-knowledge";
import type {
  RouteIntelligenceResult,
  RouteEvaluationContext,
} from "@/lib/ai-os/creative-knowledge";
import type { SceneIndustry } from "@/lib/ai-os/prompt-spec/scene-builder";
import type { MaterialTier }  from "@/lib/ai-os/prompt-spec/material-engine";
import { getMemoryService }   from "@/lib/ai-os/memory-service";
import { runGPTCreativeDirector } from "@/lib/ai-os/creative-director";
import type { GPTCampaignDirection } from "@/lib/ai-os/creative-director";
import type { UniversalPrompt } from "@/lib/prompt-os/schema";

function resolveLeadProviderId(priority: string[], preferred?: string | null): string {
  if (preferred && priority.includes(preferred)) return preferred;
  return priority[0] ?? "mock";
}

// POST /api/creative-projects/enhance-prompt
//
// Phase 10.4F — Single Pipeline Architecture.
//
// Before 10.4F both creative paths always executed in parallel: the legacy
// path (two LLM calls — Creative Brief + Universal Prompt) ran every request
// alongside the AI OS modern path (Phases 7–13), with a flag at the end
// selecting which result to use. This wasted money and latency on whichever
// path wasn't chosen.
//
// After 10.4F: flags are read early (in parallel with Asset Understanding),
// and ONLY THE ACTIVE PATH RUNS:
//
//   providerPromptEnabled = true  → modern path (Phases 7→13), no legacy LLMs
//   providerPromptEnabled = false → legacy path (L1+L2 LLMs), no Phases 11–13
//
// Common foundation (always runs regardless of path):
//   Phases 1–5  : Request → User Understanding → Asset Understanding →
//                 Creative Context → Creative Brain → Campaign Plan
//   Phase 10.4D : Memory reads + Route Intelligence + Similarity gate
//
// Response shape is backward-compatible: fields produced by the inactive path
// are null rather than absent, so existing clients reading them do not break.
export async function POST(req: NextRequest) {
  // TEMPORARY — PRODUCTION_TRACE (2026-08-03). See
  // src/lib/observability/production-trace.ts for removal instructions.
  const traceId = newTraceId();
  const reqStart = Date.now();
  traceStep(traceId, "1_BROWSER", "PASS", 0, "request received");

  const authStart = Date.now();
  const session = await requireSession();
  if (!session) {
    traceStep(traceId, "3_AUTHENTICATION", "FAIL", Date.now() - authStart, "no session");
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }
  traceStep(traceId, "3_AUTHENTICATION", "PASS", Date.now() - authStart, { userId: session.user.id });

  try {
    const rawBody = await req.json().catch(() => ({}));
    const isVariation = rawBody?.variationMode === true;
    traceStep(traceId, "2_API", "PASS", 0, { kind: rawBody?.kind, presetKey: rawBody?.presetKey, hasReferenceAsset: !!rawBody?.referenceAssetId });

    // ── AI Request Manager ────────────────────────────────────────────────
    const requestResult = await buildEnhancePromptRequest(rawBody, session.user.id);
    if (!requestResult.ok) {
      const { error } = requestResult;
      if (error.type === "RATE_LIMITED") {
        return apiError("ERR_RATE_LIMIT", error.message, 429, { retryAfterSeconds: error.retryAfterSeconds });
      }
      return apiError("ERR_VALIDATION", error.message, 400, { issues: error.details });
    }
    const creativeRequest = requestResult.request;

    // ── User Understanding Engine (Phase 2) ──────────────────────────────
    const userUnderstanding = analyzeUserRequest(creativeRequest);

    // ── Asset Understanding (Phase 3) + flags — parallel ─────────────────
    // Flags are read here (not after Phase 5) so the pipeline branch is
    // decided before any expensive downstream compute begins.
    const [assetIntelligence, gptCDEnabled, providerPromptEnabled] = await Promise.all([
      resolveAssetIntelligence(creativeRequest, session.user.id),
      getConfig("GPT_CREATIVE_DIRECTOR_ENABLED"),
      getConfig("PROVIDER_PROMPT_ENABLED"),
    ]);

    // ── Creative Context (Phase 3.5) ─────────────────────────────────────
    const creativeContext = buildCreativeContext(
      creativeRequest,
      userUnderstanding,
      assetIntelligence,
      { userId: session.user.id }
    );

    // ── Creative Brain (Phase 4) ──────────────────────────────────────────
    // timed() only measures elapsed time around the existing call — it does
    // not change creativeStrategy's value or how it is computed. Captured
    // unconditionally (both paths run this stage); only fed into a trace on
    // the modern path, where the tracer itself is constructed.
    const creativeBrainTimed = timed(() => buildCreativeStrategy(creativeContext));
    const creativeStrategy = creativeBrainTimed.result;

    // ── Creative Director / Campaign Plan (Phase 5) ───────────────────────
    const campaignPlan = buildCampaignPlan(creativeStrategy);

    // ── Phase 10.4D — Memory reads ────────────────────────────────────────
    const industry = creativeStrategy.business.industry.value as SceneIndustry;
    const rawLuxury = creativeStrategy.visual.luxuryLevel.value;
    const luxuryTier: MaterialTier =
      rawLuxury === "high" || rawLuxury === "ultra_luxury" ? "luxury" :
      rawLuxury === "medium" ? "mid" : "mass";
    const memStore = getMemoryService();
    const [memRecentEntries, memRecentHashes] = await Promise.all([
      memStore.getRecent(session.user.id, industry, 5).catch(() => []),
      memStore.getRecentFingerprints(session.user.id, industry, 5).catch(() => []),
    ]);
    const avoidHeroIds  = memRecentEntries.map(e => e.blueprint.heroMomentId).filter(Boolean);
    const avoidSceneIds = memRecentEntries.map(e => e.blueprint.sceneTypeId).filter(Boolean);

    // ── Route Intelligence (Phase 10.4B / 10.4D) ─────────────────────────
    let routeIntelligenceResult: RouteIntelligenceResult | null = null;
    let routeContext: RouteEvaluationContext | null = null;
    try {
      routeContext = buildRouteContext(
        creativeStrategy,
        campaignPlan,
        assetIntelligence,
        creativeRequest.rawIdea,
      );
      routeIntelligenceResult = evaluateIntelligence(routeContext, {
        mode:               isVariation ? "exploration" : "deterministic",
        includeFullRanking: false,
        recentFingerprints: memRecentHashes,
        ...(isVariation ? {
          modeConfig: {
            mode:   "exploration" as const,
            config: { ...DEFAULT_EXPLORATION_CONFIG, avoidHeroIds, avoidSceneIds },
          },
        } : {}),
      });
    } catch (routeErr) {
      console.warn(
        "[RouteIntelligence] evaluation failed — continuing without route selection:",
        routeErr,
      );
    }

    // ── Phase 10.4D — Similarity gate ─────────────────────────────────────
    if (isVariation && routeIntelligenceResult?.selected && routeContext && memRecentEntries.length > 0) {
      try {
        const candidateFp = buildEmptyFingerprint(
          industry,
          routeContext.campaign.goal,
          luxuryTier,
          routeIntelligenceResult.selected.route.id,
        );
        const simResult = await memStore.searchSimilar({
          targetFingerprint: candidateFp,
          scope:             "last_5",
        });
        if (simResult.recommendation === "reject") {
          const reRunResult = evaluateIntelligence(routeContext, {
            mode:               "exploration",
            includeFullRanking: false,
            recentFingerprints: memRecentHashes,
            modeConfig: {
              mode:   "exploration",
              config: { ...DEFAULT_EXPLORATION_CONFIG, avoidHeroIds, avoidSceneIds },
            },
          });
          if (reRunResult.selected) routeIntelligenceResult = reRunResult;
        }
      } catch (simErr) {
        console.warn("[MemoryStore] similarity gate failed (non-fatal):", simErr);
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // PIPELINE BRANCH — one creative path, one provider prompt.
    //
    // Modern path (providerPromptEnabled=true):
    //   Phases 7→13.  No legacy LLM calls.
    //   enhancedPrompt = providerPrompt.body.finalPrompt
    //
    // Legacy path (providerPromptEnabled=false):
    //   LLM calls L1+L2, Expander, Adapter.  No Phases 11–13.
    //   enhancedPrompt = legacyPrompt
    //
    // Response fields produced by the inactive path are null.
    // ══════════════════════════════════════════════════════════════════════

    let enhancedPrompt: string;
    let resolvedKind: import("@/generated/prisma/enums").CreativeProjectKind;
    let resolvedPresetKey: string;
    let translationTarget: SupportedProvider;

    // Modern-path output fields (null on legacy path)
    let providerPrompt:                  ProviderPrompt | null                  = null;
    let optimizedPromptSpecification:    OptimizedPromptSpecification | null     = null;
    let promptSpecification:             PromptSpecification | null              = null;
    let universalBlueprint:              UniversalCampaignBlueprint | null       = null;
    let visualScenePlan:                 VisualScenePlan | null                  = null;
    let enrichedScene:                   VisualScenePlan | null                  = null;
    let sceneGraph:                      SceneGraph | null                       = null;
    let compiledPrompt:                  CompiledPrompt | null                   = null;
    let runtimeVerification:             RuntimeVerificationReport | null        = null;
    let visualLayoutPlan:                VisualLayoutPlan | null                 = null;
    let typographyPlan:                  TypographyPlan | null                   = null;
    let gptDirection:                    GPTCampaignDirection | null             = null;
    let gptMode:                         string | null                           = null;

    // Legacy-path output fields (null on modern path)
    let expandedPrompt:                  UniversalPrompt | null                  = null;

    // Shared
    let useProviderPrompt:               boolean;
    let dilActive:                       boolean;
    let providerPromptFallbackReason:    string | null                           = null;

    if (providerPromptEnabled) {
      // ────────────────────────────────────────────────────────────────────
      // MODERN PATH — AI OS Phases 7 → 13
      // No legacy LLM calls (Creative Brief or Universal Prompt) are made.
      // ────────────────────────────────────────────────────────────────────

      // Phase 7 — GPT Creative Director (optional LLM, only on modern path)
      const refSummary = (() => {
        const ref = assetIntelligence.referenceAnalysis;
        if (!ref) return undefined;
        const parts: string[] = [];
        if (ref.visualLanguage) parts.push(ref.visualLanguage);
        if (ref.style)          parts.push(`Style: ${ref.style}`);
        if (ref.mood)           parts.push(`Mood: ${ref.mood}`);
        if (ref.lighting)       parts.push(`Lighting: ${ref.lighting}`);
        if (ref.colorPalette?.length) parts.push(`Colors: ${ref.colorPalette.join(", ")}`);
        return parts.length ? parts.join(". ") : undefined;
      })();

      const gptResult = gptCDEnabled
        ? await runGPTCreativeDirector({
            strategy:               creativeStrategy,
            userUnderstanding,
            brandContext:           assetIntelligence.brandContext,
            referenceImageAnalysis: refSummary,
            rawIdea:                creativeRequest.rawIdea,
          })
        : null;
      gptDirection = gptResult?.direction ?? null;
      gptMode      = gptResult?.mode      ?? null;

      // Phase 6 — Visual Layout Intelligence Engine
      visualLayoutPlan = buildVisualLayoutPlan(creativeStrategy, campaignPlan);

      // Phase 8 — Typography & Design System Intelligence
      typographyPlan = buildTypographyPlan(creativeStrategy, campaignPlan, visualLayoutPlan);

      // Phase 9 — Universal Campaign Blueprint
      universalBlueprint = assembleBlueprint({
        context:      creativeContext,
        strategy:     creativeStrategy,
        campaignPlan,
        layoutPlan:   visualLayoutPlan,
        typographyPlan,
        ...(gptDirection ? { gptDirection } : {}),
      });

      // Phase 10.6D — Runtime Verification System.
      // Wraps each already-existing call below with timed() (measures elapsed
      // time only — return value and behaviour are untouched) and feeds the
      // real input/output objects into the tracer. No stage's logic changes;
      // this only observes what already runs.
      const tracer = new ExecutionTreeBuilder(crypto.randomUUID());
      tracer.recordCreativeBrain(creativeStrategy, creativeBrainTimed.elapsedMs);

      // Phase 10 — Visual Scene Planning Engine
      const scenePlannerTimed = timed(() => buildVisualScenePlan(universalBlueprint!));
      visualScenePlan = scenePlannerTimed.result;
      tracer.recordScenePlanner(universalBlueprint, visualScenePlan, scenePlannerTimed.elapsedMs);

      // Phase 10.4C — Route Scene Enrichment
      enrichedScene = routeIntelligenceResult?.selected
        ? applyRouteToScene(visualScenePlan, routeIntelligenceResult.selected.route)
        : visualScenePlan;

      // Phase 10.6B — Dynamic Scene Graph Compiler (executes exactly once).
      // Input: VisualScenePlan. Output: SceneGraph. Becomes the single source
      // of truth for camera/pose/materials/background/interaction/environment
      // content the Prompt Specification builders below no longer regenerate.
      const sceneGraphTimed = timed(() => buildSceneGraph(universalBlueprint!, enrichedScene!));
      sceneGraph = sceneGraphTimed.result;
      tracer.recordSceneGraphCompiler(enrichedScene, sceneGraph, sceneGraphTimed.elapsedMs);

      // Phase 11 — Prompt Specification Engine
      const specTimed = timed(() => buildPromptSpecification(universalBlueprint!, enrichedScene!, gptDirection ?? undefined, sceneGraph!));
      promptSpecification = specTimed.result;
      tracer.recordPromptSpecification(promptSpecification, sceneGraph, specTimed.elapsedMs);

      // Phase 10.6A — Prompt Visual Compiler (executes exactly once).
      // Input: PromptSpecification. Output: CompiledPromptSpecification (a
      // classified, visual-language field-level compilation). Its verdicts are
      // applied back onto promptSpecification's own fields — every downstream
      // consumer (Prompt Optimizer, every Provider Translator) reads compiled
      // text through the exact same field it already reads today.
      const specBeforeCompile = promptSpecification;
      const compilerTimed = timed(() => {
        const compiled = compileToVisualLanguage(specBeforeCompile);
        return { compiled, applied: applyCompiledPrompt(specBeforeCompile, compiled) };
      });
      compiledPrompt = compilerTimed.result.compiled;
      promptSpecification = compilerTimed.result.applied;
      tracer.recordPromptVisualCompiler(specBeforeCompile, promptSpecification, compiledPrompt, compilerTimed.elapsedMs);

      // Phase 12 — AI Prompt Optimization Engine
      const specBeforeOptimize = promptSpecification;
      const optimizerTimed = timed(() => optimizePromptSpecification(specBeforeOptimize));
      optimizedPromptSpecification = optimizerTimed.result;
      tracer.recordPromptOptimizer(specBeforeOptimize, optimizedPromptSpecification, optimizerTimed.elapsedMs);

      // Kind resolution — no universalPrompt available; keyword-match the raw
      // idea (same logic resolveKindAndPreset already uses as a fallback).
      // When the client provides kind directly, it takes precedence as usual.
      const kindResult = creativeRequest.kind
        ? {
            kind:      creativeRequest.kind,
            presetKey: creativeRequest.presetKey ?? DEFAULT_PRESET_BY_KIND[creativeRequest.kind],
          }
        : resolveKindAndPreset({ idea: creativeRequest.rawIdea });
      resolvedKind      = kindResult.kind;
      resolvedPresetKey = kindResult.presetKey;

      // Provider resolution
      const tool = await prisma.creativeTool.findUnique({
        where: { key: TOOL_KEY_BY_KIND[resolvedKind] },
      });
      const priority     = await listEnabledProviderConfigs("IMAGE");
      const leadProviderId = resolveLeadProviderId(priority, tool?.defaultProviderId);
      translationTarget  = resolveProviderForTranslation(leadProviderId);

      // Phase 13 — Multi-Provider Translation Layer
      try {
        const translatorTimed = timed(() => translateForProvider(optimizedPromptSpecification!, translationTarget));
        providerPrompt  = translatorTimed.result;
        enhancedPrompt  = providerPrompt.body.finalPrompt;

        // Phase 10.6D — Runtime Verification System.
        // specFieldsConsumed / compilerFieldsConsumed are computed once here
        // (not re-derived per downstream consumer) from the exact same
        // promptSpecification/sceneGraph/compiledPrompt objects already in
        // scope — the tracer, the per-provider report, and the influence
        // graph all read from this one real measurement.
        const sceneGraphConsumption = detectSceneGraphConsumption(promptSpecification!, sceneGraph!);
        const compilerFieldsConsumed = compiledPrompt!.fields
          .filter((f) => (f.classification === "A" || f.classification === "B") && f.compiledValue !== undefined && f.compiledValue !== f.originalValue)
          .map((f) => f.path);

        tracer.recordProviderTranslator(
          optimizedPromptSpecification!,
          providerPrompt,
          translatorTimed.elapsedMs,
          sceneGraphConsumption.specFieldsConsumed,
          compilerFieldsConsumed,
        );

        // All 4 named providers + sentence-level provenance are computed
        // purely for this report — the primary result above is unaffected,
        // still exactly the one resolved `translationTarget` translation.
        const providerTraces = buildProviderReport(
          optimizedPromptSpecification!,
          sceneGraphConsumption.specFieldsConsumed,
          compilerFieldsConsumed,
        );
        const influenceGraph = buildInfluenceGraph(
          optimizedPromptSpecification!.optimizedSpec,
          compiledPrompt!,
          enhancedPrompt,
          translationTarget,
        );
        const executionTree = tracer.build(translationTarget, enhancedPrompt);
        const runtimeReport = buildRuntimeReport(executionTree, compiledPrompt!, providerTraces);
        runtimeVerification = assembleFinalReport(executionTree, runtimeReport, providerTraces, influenceGraph);
      } catch (translationErr) {
        providerPromptFallbackReason =
          translationErr instanceof Error ? translationErr.message : "Phase 13 translation failed";
        console.warn(
          "[Phase13] translateForProvider failed — re-throwing (Phase 13 is pure compute; " +
          "this indicates a code bug, not a transient failure):",
          translationErr,
        );
        throw translationErr;
      }

      useProviderPrompt = true;
      dilActive         = true;

    } else {
      // ────────────────────────────────────────────────────────────────────
      // LEGACY PATH — Creative Brief (LLM #1) + Universal Prompt (LLM #2)
      // Phase 13 is skipped; the expanded prompt → adapter produces the final string.
      // ────────────────────────────────────────────────────────────────────

      // Preset lookup (needed by buildPromptOsInput)
      const preset =
        creativeRequest.kind && creativeRequest.presetKey
          ? PRESETS_BY_KIND[creativeRequest.kind].find((p) => p.key === creativeRequest.presetKey)
          : undefined;
      const promptOsInput = buildPromptOsInput(creativeContext, preset?.label);
      traceStep(traceId, "5_PROMPT_COMPILER", "PASS", 0, "promptOsInput built (legacy path)");

      // TEMPORARY — real LLM provider chain about to be attempted, logged
      // before the call so a hang is visible as "6 logged, 7/8 never
      // logged" rather than silence.
      const llmPriority = await listEnabledProviderConfigs("LLM");
      traceStep(traceId, "6_PROVIDER_SELECTION", "PASS", 0, { configuredPriority: llmPriority });

      // Phase L1 — Creative Brief (LLM call #1)
      const l1Start = Date.now();
      let creativeBrief;
      try {
        creativeBrief = await buildCreativeBrief(promptOsInput, session.user.id);
        traceStep(traceId, "7_8_PROVIDER_REQUEST_RESPONSE_LLM1_creative_direction", "PASS", Date.now() - l1Start);
      } catch (llm1Err) {
        // Real, unsanitized error — the founder explicitly does not want
        // this replaced with "Couldn't complete AI request."
        const detail = llm1Err instanceof Error ? llm1Err.message : String(llm1Err);
        traceStep(traceId, "7_8_PROVIDER_REQUEST_RESPONSE_LLM1_creative_direction", "FAIL", Date.now() - l1Start, detail);
        throw llm1Err;
      }

      // Phase L2 — Universal Prompt (LLM call #2)
      const l2Start = Date.now();
      let universalPrompt;
      try {
        universalPrompt = await buildUniversalPromptFromIdea(
          {
            ...promptOsInput,
            creativeBrief,
            output: {
              aspectRatio: preset?.aspectRatio,
              targetWidth: preset?.targetWidth,
              targetHeight: preset?.targetHeight,
            },
          },
          session.user.id
        );
        traceStep(traceId, "7_8_PROVIDER_REQUEST_RESPONSE_LLM2_prompt_engineering", "PASS", Date.now() - l2Start);
      } catch (llm2Err) {
        const detail = llm2Err instanceof Error ? llm2Err.message : String(llm2Err);
        traceStep(traceId, "7_8_PROVIDER_REQUEST_RESPONSE_LLM2_prompt_engineering", "FAIL", Date.now() - l2Start, detail);
        throw llm2Err;
      }

      // Kind resolution — uses universalPrompt fields (same as before 10.4F)
      const kindResult = creativeRequest.kind
        ? {
            kind:      creativeRequest.kind,
            presetKey: creativeRequest.presetKey ?? DEFAULT_PRESET_BY_KIND[creativeRequest.kind],
          }
        : resolveKindAndPreset({
            recommendedKind:    universalPrompt.output.recommendedKind,
            recommendedPresetKey: universalPrompt.output.recommendedPresetKey,
            creativeType:       universalPrompt.creative_type,
            platform:           universalPrompt.platform,
            idea:               creativeRequest.rawIdea,
          });
      resolvedKind      = kindResult.kind;
      resolvedPresetKey = kindResult.presetKey;

      // Provider resolution
      const tool = await prisma.creativeTool.findUnique({
        where: { key: TOOL_KEY_BY_KIND[resolvedKind] },
      });
      traceStep(traceId, "4_DATABASE", tool ? "PASS" : "FAIL", 0, { toolKey: TOOL_KEY_BY_KIND[resolvedKind], found: !!tool, enabled: tool?.enabled });
      const priority     = await listEnabledProviderConfigs("IMAGE");
      const leadProviderId = resolveLeadProviderId(priority, tool?.defaultProviderId);
      translationTarget  = resolveProviderForTranslation(leadProviderId);

      // Expander + Adapter
      expandedPrompt = expandUniversalPrompt(universalPrompt);
      const adapter  = resolvePromptAdapter(leadProviderId);
      const legacyPrompt = cleanEnhancedPrompt(adapter(expandedPrompt));

      enhancedPrompt    = legacyPrompt;
      useProviderPrompt = false;
      dilActive         = false;
    }

    // ── Phase 10.4D — Fire-and-forget memory save ─────────────────────────
    // enrichedScene is only available on the modern path; use empty strings
    // on the legacy path so the avoidance keys (routeId/heroId/sceneId) are
    // still stored correctly — the scene text fields are display-only.
    if (routeIntelligenceResult?.selected && routeContext) {
      const { selected } = routeIntelligenceResult;
      const memEntry = buildMemoryEntry({
        userId:          session.user.id,
        rawIdea:         creativeRequest.rawIdea,
        industry,
        campaignGoal:    routeContext.campaign.goal,
        luxuryTier,
        selectedRouteId: selected.route.id,
        heroMomentId:    selected.heroMomentId,
        sceneTypeId:     selected.sceneTypeId,
        archetypeId:     selected.archetypeId,
        routeScore:      selected.score,
        heroSubjectText: enrichedScene?.heroSubject?.exactHeroSubject?.value ?? "",
        environmentText: enrichedScene?.environment?.environmentType?.value  ?? "",
        lightingText:    enrichedScene?.lighting?.moodLighting?.value        ?? "",
        compositionText: enrichedScene?.composition?.primaryComposition?.value ?? "",
        finalPrompt:     enhancedPrompt,
        providerTarget:  translationTarget,
      });
      void memStore.save(memEntry).catch(saveErr =>
        console.warn("[MemoryStore] entry save failed (non-fatal):", saveErr)
      );
    }

    // No STORAGE/DATABASE_SAVE step — enhance-prompt never persists a
    // CreativeProject or writes to storage (that only happens in the
    // separate POST /api/creative-projects call).
    traceStep(traceId, "9_STORAGE", "PASS", 0, "not applicable to this route");
    traceStep(traceId, "10_DATABASE_SAVE", "PASS", 0, "not applicable to this route");
    traceStep(traceId, "11_FINAL_RESPONSE", "PASS", Date.now() - reqStart, "200 success");

    return apiSuccess({
      // ── Production fields — always present ────────────────────────────
      enhancedPrompt,
      resolvedKind,
      resolvedPresetKey,
      isVariation,
      useProviderPrompt,
      dilActive,           // backward-compat alias for useProviderPrompt
      providerPromptFallbackReason,
      // ── Always-available debug fields ────────────────────────────────
      userUnderstanding,
      creativeStrategy,
      campaignPlan,
      routeIntelligenceResult,
      // ── Modern-path fields (null on legacy path) ──────────────────────
      providerPrompt,
      optimizedPromptSpecification,
      promptSpecification,
      universalBlueprint,
      visualScenePlan,
      enrichedScene,
      sceneGraph,
      compiledPrompt,
      runtimeVerification,
      visualLayoutPlan,
      typographyPlan,
      gptDirection,
      gptMode,
      // ── Legacy-path fields (null on modern path) ──────────────────────
      universalPrompt: expandedPrompt,
    });
  } catch (err) {
    // TEMPORARY — the real, unsanitized error, always. This does NOT change
    // what the client receives below (that's a separate, deliberate design
    // decision — see describeAllProvidersFailure()'s own comment) — it only
    // guarantees the real cause is visible in the server log for this
    // investigation.
    const realErrorDetail =
      err instanceof AllProvidersFailedError
        ? err.message // full per-provider detail, e.g. "gemini (2 attempt(s): <real vendor error>); openai (...)"
        : err instanceof Error
          ? err.message
          : String(err);
    traceStep(traceId, "11_FINAL_RESPONSE", "FAIL", Date.now() - reqStart, realErrorDetail);

    if (err instanceof AssetNotFoundError) {
      return apiError("ERR_NOT_FOUND", "Reference image not found.", 404);
    }
    console.error("POST /api/creative-projects/enhance-prompt failed", err);
    // Real incident (2026-07-24) — the old flat "Couldn't enhance your
    // prompt" message looked identical whether this was a genuine outage
    // worth retrying or a persistent billing/quota block needing admin
    // action, hiding real signal every time this fired. See
    // describeAllProvidersFailure()'s own comment for the real live
    // incident (simultaneous Gemini overload + OpenAI quota exhaustion)
    // that prompted this.
    if (err instanceof AllProvidersFailedError) {
      return apiError("ERR_INTERNAL", describeAllProvidersFailure(err), 502);
    }
    const message = err instanceof Error ? err.message : "Couldn't enhance your prompt. Please try again.";
    return apiError("ERR_INTERNAL", message, 500);
  }
}
