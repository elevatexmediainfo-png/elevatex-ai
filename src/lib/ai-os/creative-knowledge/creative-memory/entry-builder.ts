// Phase 10.4D — Creative Memory Platform: entry builder.
//
// Assembles a CreativeMemoryEntry from pipeline outputs after a successful
// generation. Called once per request in enhance-prompt/route.ts before
// the response is returned (fire-and-forget — no await at call site).
//
// Phase 10.4D: all ID fields except selectedRouteId are empty strings.
// Phase 10.4E+: heroMomentId, sceneTypeId, archetypeId populated from
//               knowledge graph and archetype registry.

import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { MaterialTier }  from "../../prompt-spec/material-engine";
import type { CampaignGoal, ArchetypeId, HeroMomentId, SceneTypeId } from "../types";
import type { RouteScore }    from "../route-engine/types";
import type {
  CreativeMemoryEntry,
  MemoryInput,
  MemoryBlueprint,
  MemoryHero,
  MemoryScene,
  MemoryPrompt,
  MemoryOutputMetadata,
} from "./types";
import { buildEmptyDiversityMetadata } from "../diversity-metadata/extractor";
import { buildFingerprint }            from "./fingerprint";

// ── Params ────────────────────────────────────────────────────────────────────

/** All pipeline outputs needed to build one CreativeMemoryEntry. */
export interface MemoryEntryParams {
  /** Authenticated user ID. */
  userId:           string;
  /** Original user idea string. */
  rawIdea:          string;
  /** Resolved industry for this generation. */
  industry:         SceneIndustry;
  /** Campaign goal driving this generation. */
  campaignGoal:     CampaignGoal;
  /** Material/luxury tier. */
  luxuryTier:       MaterialTier;
  /** Phase 8.6 creative route that was selected. */
  selectedRouteId:  string;
  /** Hero moment ID from the knowledge graph. */
  heroMomentId:     HeroMomentId;
  /** Scene type ID from the knowledge graph. */
  sceneTypeId:      SceneTypeId;
  /** Hero emotion category (heroCategory from heroGraph). Empty string if not available. */
  emotionId?:       string;
  /** Scene environment category (sceneCategory from heroGraph). Empty string if not available. */
  environmentId?:   string;
  /** Archetype ID for this generation. Empty string in Phase 10.4D. */
  archetypeId:      ArchetypeId;
  /** Route scoring dimensions from the route intelligence engine. */
  routeScore:       RouteScore;
  /** Resolved hero subject text from the enriched scene plan. */
  heroSubjectText:  string;
  /** Environment description from the enriched scene plan. */
  environmentText:  string;
  /** Lighting description from the enriched scene plan. */
  lightingText:     string;
  /** Composition description from the enriched scene plan. */
  compositionText:  string;
  /** Final compiled prompt sent to the image provider. */
  finalPrompt:      string;
  /** Provider target identifier (e.g. "fal_flux", "openai_dall_e"). */
  providerTarget:   string;
  /** Creative project DB ID — omitted until the project is saved (Phase 10.5+). */
  projectId?:       string;
  /** Asset DB ID of the generated image — omitted until stored (Phase 10.5+). */
  assetId?:         string;
}

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Build a complete CreativeMemoryEntry from pipeline outputs.
 * Pure function — no I/O, no side effects.
 *
 * Returns a fully typed entry ready for MemoryStore.save().
 * The caller is responsible for awaiting the save (or using fire-and-forget).
 */
export function buildMemoryEntry(params: MemoryEntryParams): CreativeMemoryEntry {
  const {
    userId,
    rawIdea,
    industry,
    campaignGoal,
    luxuryTier,
    selectedRouteId,
    heroMomentId,
    sceneTypeId,
    emotionId      = "",
    environmentId  = "",
    archetypeId,
    routeScore,
    heroSubjectText,
    environmentText,
    lightingText,
    compositionText,
    finalPrompt,
    providerTarget,
    projectId,
    assetId,
  } = params;

  const now = new Date();

  // ── Input ────────────────────────────────────────────────────────────────────
  const input: MemoryInput = {
    rawIdea,
    industry,
    campaignGoal,
    luxuryTier,
    signals: {
      industry,
      campaignGoal,
      rawIdea,
      luxuryTier,
    },
  };

  // ── Blueprint ────────────────────────────────────────────────────────────────
  const blueprint: MemoryBlueprint = {
    selectedRouteId,
    archetypeId,
    heroMomentId,
    sceneTypeId,
    ...(emotionId     ? { emotionId }     : {}),
    ...(environmentId ? { environmentId } : {}),
    score: routeScore,
  };

  // ── Hero ─────────────────────────────────────────────────────────────────────
  const hero: MemoryHero = {
    subject: heroSubjectText,
    source:  heroMomentId !== "" ? "knowledge_graph" : "gpt_creative_director",
  };

  // ── Scene ─────────────────────────────────────────────────────────────────────
  const scene: MemoryScene = {
    environment:  environmentText,
    lighting:     lightingText,
    composition:  compositionText,
  };

  // ── Prompt ────────────────────────────────────────────────────────────────────
  const prompt: MemoryPrompt = {
    finalPrompt,
    providerTarget,
    blocksPresent:  [],
    realismApplied: false,
    materialTier:   luxuryTier,
  };

  // ── Output ────────────────────────────────────────────────────────────────────
  const fp = buildFingerprint({
    heroId:          heroMomentId,
    sceneId:         sceneTypeId,
    emotionId,
    environmentId,
    behaviourIds:    [],
    relationshipIds: [],
    layoutId:        "",
    cameraId:        "",
    lightingId:      "",
    compositionId:   "",
    routeId:         selectedRouteId,
    archetypeIds:    [],
    psychologyIds:   [],
    industryId:      industry,
    campaignGoal,
    luxuryTier,
  });
  const output: MemoryOutputMetadata = {
    generatedAt: now,
    ...(projectId ? { projectId } : {}),
    ...(assetId   ? { assetId }   : {}),
    fingerprint: fp.hash,
  };

  // ── Diversity ─────────────────────────────────────────────────────────────────
  const diversity = buildEmptyDiversityMetadata();

  return {
    id:        crypto.randomUUID(),
    userId,
    timestamp: now,
    input,
    blueprint,
    hero,
    scene,
    prompt,
    output,
    diversity,
  };
}
