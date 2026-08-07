import { computeBrollTargetRange } from "@/lib/providers/reasoning/gpt5.provider";
import { AI_QUALITY_CATEGORIES, type AIBroll, type AICaption, type AIMusic, type AISceneRemoval, type AISfx, type AiQualityCategory, type AiQualityScoresV2 } from "@/lib/validations/ai-timeline";
import { clamp0to100, scoreCaptions, scorePacing } from "../ai-edit-quality-scoring";
import { scoreVisualVariety } from "./variety-ledger";
import type { DirectorAgentId, DirectorIterationEntry, VarietyLedger } from "./types";

// AI Video Director (2026-08-07) — the 10-category quality rubric (TASK
// 12 in the approved plan). 6 categories are scored HERE, deterministically,
// with zero LLM call (captions/broll/visualVariety/pacing/music/sfx); 4
// require genuine judgment (hook/emotion/retention/storyFlow) and come
// from the Quality Reviewer agent's own reviewQuality() call
// (director/orchestrator.ts wires that call and passes its result in).

export interface DeterministicScores {
  captionScore: number;
  brollScore: number;
  visualVarietyScore: number;
  pacingScore: number;
  musicScore: number;
  sfxScore: number;
}

// Deliberately counts PROPOSED items (broll.length), never resolvedAssetId
// — see ai-edit-quality-scoring.ts's own flagged comment for why filtering
// on resolvedAssetId here would be a real, silent bug: this scoring runs
// BEFORE asset resolution, at the same pipeline point the legacy scorer's
// own (flagged, unfixed) bug lives at.
export function scoreBrollDeterministic(broll: AIBroll[], sourceDurationMs: number, brollDensity: "MINIMAL" | "BALANCED" | "HEAVY" | undefined): number {
  const { min, max } = computeBrollTargetRange(sourceDurationMs, brollDensity);
  const count = broll.length;
  const fit = count >= min && count <= max ? 1 : count < min ? Math.max(0, count / Math.max(1, min)) : Math.max(0, 1 - (count - max) / Math.max(1, max));
  return clamp0to100(fit * 100);
}

// Absence of music is a valid editorial choice (the Audio agent's own
// prompt says so explicitly) — never scored as a defect. Presence with no
// real query/asset to act on IS a defect (a half-formed proposal).
export function scoreMusicDeterministic(music: AIMusic | undefined): number {
  if (!music) return 100;
  return music.searchQuery || music.assetId ? 100 : 40;
}

// Zero sfx is valid (same "propose fewer rather than pad" principle as
// b-roll). Anti-spam: a rolling window with more than maxPer10s events
// scores down — the brief's own "NEVER SPAM" requirement, made concrete.
export function scoreSfxDeterministic(sfx: AISfx[], maxPer10s: number): number {
  if (sfx.length === 0) return 100;
  const sorted = [...sfx].sort((a, b) => a.atMs - b.atMs);
  let violations = 0;
  for (const anchor of sorted) {
    const windowEnd = anchor.atMs + 10_000;
    const countInWindow = sorted.filter((s) => s.atMs >= anchor.atMs && s.atMs < windowEnd).length;
    if (countInWindow > maxPer10s) violations++;
  }
  return violations === 0 ? 100 : clamp0to100(100 - violations * 20);
}

export function computeDeterministicScores(input: {
  captions: AICaption[];
  broll: AIBroll[];
  sceneRemoval: AISceneRemoval[];
  music?: AIMusic;
  sfx: AISfx[];
  varietyLedger: VarietyLedger;
  sourceDurationMs: number;
  brollDensity?: "MINIMAL" | "BALANCED" | "HEAVY";
  sfxMaxPer10s: number;
}): DeterministicScores {
  return {
    captionScore: input.captions.length > 0 ? scoreCaptions(input.captions, input.sourceDurationMs) : 100,
    brollScore: scoreBrollDeterministic(input.broll, input.sourceDurationMs, input.brollDensity),
    visualVarietyScore: scoreVisualVariety(input.varietyLedger),
    pacingScore: input.captions.length > 0 ? scorePacing(input.sceneRemoval, input.captions, input.sourceDurationMs) : 100,
    musicScore: scoreMusicDeterministic(input.music),
    sfxScore: scoreSfxDeterministic(input.sfx, input.sfxMaxPer10s),
  };
}

export function computeOverallScore(perCategory: Record<AiQualityCategory, number>, weights: Partial<Record<AiQualityCategory, number>>): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const category of AI_QUALITY_CATEGORIES) {
    const weight = weights[category] ?? 1;
    weightedSum += perCategory[category] * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? clamp0to100(weightedSum / totalWeight) : 100;
}

// A category scoring below this (deterministic categories only — the
// judged ones rely on the reviewer's own self-reported weakCategories
// instead of a second numeric cutoff) is folded into weakCategoriesFinal
// even if the reviewer agent didn't separately flag it.
const DETERMINISTIC_WEAK_THRESHOLD = 60;

export interface QualityReviewerJudgedScores {
  hookScore: number;
  emotionScore: number;
  retentionScore: number;
  storyFlowScore: number;
  weakCategories: AiQualityCategory[];
}

export function buildQualityScoresV2(
  deterministic: DeterministicScores,
  judged: QualityReviewerJudgedScores,
  weights: Partial<Record<AiQualityCategory, number>>,
  targetScore: number,
  iterations: number
): AiQualityScoresV2 {
  const perCategory: Record<AiQualityCategory, number> = {
    hook: judged.hookScore,
    captions: deterministic.captionScore,
    broll: deterministic.brollScore,
    visualVariety: deterministic.visualVarietyScore,
    pacing: deterministic.pacingScore,
    emotion: judged.emotionScore,
    retention: judged.retentionScore,
    music: deterministic.musicScore,
    sfx: deterministic.sfxScore,
    storyFlow: judged.storyFlowScore,
  };
  const overallScore = computeOverallScore(perCategory, weights);
  const weakFromDeterministic = AI_QUALITY_CATEGORIES.filter((c) => perCategory[c] < DETERMINISTIC_WEAK_THRESHOLD);
  const weakCategoriesFinal = Array.from(new Set([...weakFromDeterministic, ...judged.weakCategories]));

  return {
    captionScore: deterministic.captionScore,
    brollScore: deterministic.brollScore,
    visualVarietyScore: deterministic.visualVarietyScore,
    pacingScore: deterministic.pacingScore,
    musicScore: deterministic.musicScore,
    sfxScore: deterministic.sfxScore,
    hookScore: judged.hookScore,
    emotionScore: judged.emotionScore,
    retentionScore: judged.retentionScore,
    storyFlowScore: judged.storyFlowScore,
    overallScore,
    thresholdMet: overallScore >= targetScore,
    iterations,
    weakCategoriesFinal,
  };
}

// ---------------------------------------------------------------------
// Weak category -> target agent routing. The concrete generalization of
// ai-os/retry-orchestrator's own MODULE_SPEC idea to this pipeline's real
// data-dependency graph (not literally imported — different domain/type
// system — the ALGORITHM shape is reused: map weak category to a target
// agent, then invalidate/rerun everything downstream that consumed its
// output).
// ---------------------------------------------------------------------

export const CATEGORY_AGENT_MAP: Record<AiQualityCategory, DirectorAgentId[]> = {
  hook: ["story"],
  captions: ["captions"],
  broll: ["visuals"],
  visualVariety: ["visuals"],
  pacing: ["visuals"],
  emotion: ["story", "visuals"],
  retention: ["story"],
  music: ["audio"],
  sfx: ["audio"],
  storyFlow: ["story", "captions"],
};

// If an earlier agent reruns, everything that consumed ITS output is now
// stale and must rerun too — story feeds captions/visuals/audio, captions
// feeds visuals/audio, visuals feeds audio, audio feeds nothing further.
export const DOWNSTREAM_OF: Record<DirectorAgentId, DirectorAgentId[]> = {
  story: ["captions", "visuals", "audio"],
  captions: ["visuals", "audio"],
  visuals: ["audio"],
  audio: [],
  review: [],
};

export function resolveAgentsToRerun(weakCategories: AiQualityCategory[]): DirectorAgentId[] {
  const direct = new Set<DirectorAgentId>();
  for (const category of weakCategories) {
    for (const agent of CATEGORY_AGENT_MAP[category]) direct.add(agent);
  }
  const all = new Set(direct);
  for (const agent of direct) {
    for (const downstream of DOWNSTREAM_OF[agent]) all.add(downstream);
  }
  return Array.from(all);
}

// Stagnation detection — a simplified single-shared-budget analogue of
// ai-os/retry-orchestrator's own per-action 5-window loop detector. This
// pipeline has ONE shared iteration budget (not five independent
// unlimited-retry actions), so a simple "2 consecutive non-improving
// rounds" rule is the honest, sufficient version of the same idea:
// spending the remaining iteration budget on a direction that already
// isn't working is worse than stopping early and keeping the best
// attempt seen.
export function countTrailingNonImproving(history: DirectorIterationEntry[]): number {
  let count = 0;
  for (let i = history.length - 1; i > 0; i--) {
    if (history[i].scores.overallScore <= history[i - 1].scores.overallScore) count++;
    else break;
  }
  return count;
}

export const STAGNATION_ROUNDS = 2;
