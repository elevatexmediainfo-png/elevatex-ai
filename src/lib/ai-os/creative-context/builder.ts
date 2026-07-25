import type { CreativeRequest, UserUnderstanding, AssetIntelligence } from "../types";
import type { CreativeContext, SessionContext } from "./types";
// PromptOsContextInput is imported read-only as a TYPE — this does not modify
// the Creative Brain in any way; it only reads its public type contract.
import type { PromptOsContextInput } from "@/lib/prompt-os/builder";

// Phase 3.5 — Creative Context Builder.
// Two pure functions with no side effects:
//
// 1. buildCreativeContext() — assembles the CreativeContext from the three AI OS
//    module outputs + session. This is the ONLY place in the codebase that
//    merges CreativeRequest + UserUnderstanding + AssetIntelligence.
//
// 2. buildPromptOsInput() — maps a CreativeContext to PromptOsContextInput,
//    the type the Creative Brain and Creative Director already accept. This is
//    the BRIDGE between the AI OS layer and the existing creative pipeline.
//    For now it maps fields 1:1. Phase 4 will extend this to also surface
//    UserUnderstanding fields (industry, intent, audience) into the context
//    lines that the Creative Director reads.

/** Assembles a CreativeContext from the three AI OS module outputs. */
export function buildCreativeContext(
  request: CreativeRequest,
  userUnderstanding: UserUnderstanding,
  assetIntelligence: AssetIntelligence,
  sessionContext: SessionContext
): CreativeContext {
  return {
    request,
    userUnderstanding,
    assetIntelligence,
    sessionContext,
    createdAt: new Date().toISOString(),
  };
}

/** Maps a CreativeContext to the PromptOsContextInput shape that the Creative
 *  Brain (buildUniversalPromptFromIdea) and Creative Director (buildCreativeBrief)
 *  already accept. `presetLabel` is passed separately because the preset lookup
 *  requires the validated preset catalog, which belongs in the caller's scope.
 *
 *  This function is the handoff point identified in the architecture audit.
 *  Today it passes the same fields that were previously assembled inline in the
 *  route. Phase 4 will extend it to also feed UserUnderstanding signals into
 *  the context, without touching any Creative Brain / Creative Director code. */
export function buildPromptOsInput(
  context: CreativeContext,
  presetLabel?: string
): PromptOsContextInput {
  return {
    idea: context.request.rawIdea,
    kind: context.request.kind,
    presetLabel,
    referenceAnalysis: context.assetIntelligence.referenceAnalysis,
    // BrandContext shape matches PromptOsContextInput.brandKit exactly.
    brandKit: context.assetIntelligence.brandContext ?? undefined,
  };
}
