// Generation Mode System: intent and execution signatures.
//
// Two hashes track what is PRESERVED vs. what VARIES across generation calls.
//
// IntentSignature  — the business brief. Must be IDENTICAL across
//                    all regenerations of the same campaign.
//                    Fields: industry + campaignGoal + audienceTier +
//                            luxuryTier + campaignType
//
// ExecutionSignature — the creative execution. Must be DIFFERENT in
//                      exploration mode to ensure visual novelty.
//                      Fields: heroMomentId + sceneTypeId + routeId + archetypeId
//
// Relationship:
//   Same intent + same execution = deterministic reproduction
//   Same intent + different execution = successful creative exploration
//   Different intent = different brief (not a regeneration)
//
// Both signatures are stable, pure functions of their input fields.
// No I/O, no timestamps, no randomness.

import type { RouteEvaluationContext } from "../route-intelligence/types";
import type { ScoredRouteCandidate }   from "../route-intelligence/types";
import type { IntentSignature, ExecutionSignature } from "./types";

const ANY = "any";
const NONE = "none";

function orAny(v: string | undefined): string  { return v || ANY;  }
function orNone(v: string | undefined): string { return v || NONE; }

// ── IntentSignature ────────────────────────────────────────────────────────────

/**
 * Compute the IntentSignature for a RouteEvaluationContext.
 *
 * Intent-defining fields (5):
 *   1. industry      — always present (required in context)
 *   2. campaignGoal  — always present (required in context.campaign)
 *   3. audienceTier  — optional; "any" when absent
 *   4. luxuryTier    — optional; "any" when absent
 *   5. campaignType  — optional; "any" when absent
 *
 * The signature is stable: calling this function twice with the same
 * context always produces the same hash.
 *
 * Future callers that want to verify "is this a regeneration of the same
 * brief?" compare intentSignatures via intentSignaturesMatch().
 */
export function computeIntentSignature(context: RouteEvaluationContext): IntentSignature {
  const industry     = context.industry;
  const campaignGoal = context.campaign.goal;
  const audienceTier = orAny(context.audience?.tier);
  const luxuryTier   = orAny(context.luxuryTier);
  const campaignType = orAny(context.campaign.type);

  const hash = [industry, campaignGoal, audienceTier, luxuryTier, campaignType].join("|");

  return { hash, industry, campaignGoal, audienceTier, luxuryTier, campaignType };
}

/**
 * True when two contexts describe the same campaign brief.
 * Used to confirm that a regeneration is for the same intent.
 */
export function intentSignaturesMatch(a: IntentSignature, b: IntentSignature): boolean {
  return a.hash === b.hash;
}

/**
 * Reconstruct an IntentSignature from a stored hash string.
 * Used when comparing against a historical signature stored in the DB.
 * The hash format is: "{industry}|{campaignGoal}|{audienceTier}|{luxuryTier}|{campaignType}"
 *
 * Returns null if the hash does not have exactly 5 segments.
 */
export function parseIntentSignatureHash(hash: string): IntentSignature | null {
  const parts = hash.split("|");
  if (parts.length !== 5) return null;
  const [industry, campaignGoal, audienceTier, luxuryTier, campaignType] = parts;
  return { hash, industry, campaignGoal, audienceTier, luxuryTier, campaignType };
}

// ── ExecutionSignature ─────────────────────────────────────────────────────────

/**
 * Compute the ExecutionSignature for a ScoredRouteCandidate.
 *
 * Execution-defining fields (4):
 *   1. heroMomentId  — the creative subject (who/what is in the frame)
 *   2. sceneTypeId   — the environment (where it happens)
 *   3. routeId       — the creative strategy direction
 *   4. archetypeId   — the psychological archetype
 *
 * In Phase 10.4D the graph is not populated — heroMomentId and sceneTypeId
 * are empty strings. The hash will be "none|none|{routeId}|none" until the
 * graph is populated. Exploration mode degrades to route-level diversity only.
 *
 * This is intentional and correct — diversity checking gracefully degrades
 * to "avoid recently used route" when hero/scene IDs are not yet populated.
 */
export function computeExecutionSignature(candidate: ScoredRouteCandidate): ExecutionSignature {
  const heroMomentId = orNone(candidate.heroMomentId);
  const sceneTypeId  = orNone(candidate.sceneTypeId);
  const routeId      = orNone(candidate.route.id);
  const archetypeId  = orNone(candidate.archetypeId);

  const hash = [heroMomentId, sceneTypeId, routeId, archetypeId].join("|");

  return { hash, heroMomentId, sceneTypeId, routeId, archetypeId };
}

/**
 * True when two execution signatures are the same creative execution.
 * Used to detect: "this candidate would produce the same visual as the last generation."
 */
export function executionSignaturesMatch(a: ExecutionSignature, b: ExecutionSignature): boolean {
  return a.hash === b.hash;
}

/**
 * True when two execution signatures share the same hero moment.
 * Used in exploration mode: "has this hero subject been used recently?"
 * Returns false when either heroMomentId is "none" (not populated yet).
 */
export function shareHeroMoment(a: ExecutionSignature, b: ExecutionSignature): boolean {
  return a.heroMomentId !== NONE && a.heroMomentId === b.heroMomentId;
}

/**
 * True when two execution signatures share the same scene type.
 * Used in exploration mode: "has this scene been used recently?"
 * Returns false when either sceneTypeId is "none" (not populated yet).
 */
export function shareSceneType(a: ExecutionSignature, b: ExecutionSignature): boolean {
  return a.sceneTypeId !== NONE && a.sceneTypeId === b.sceneTypeId;
}

/**
 * Collect all unique execution signatures from a list of hash strings.
 * Phase 10.5F: fed from MemoryStore.getRecent() execution signature hashes.
 * Used to build the avoidFingerprintHashes set for ExplorationFilter.
 */
export function parseExecutionHashes(hashes: string[]): Set<string> {
  return new Set(hashes.filter(h => h.length > 0));
}
