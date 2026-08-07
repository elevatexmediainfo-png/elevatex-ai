import { computeBrollTargetRange } from "@/lib/providers/reasoning/gpt5.provider";
import type { ReasoningZoomItem } from "@/lib/providers/reasoning";
import { AI_QUALITY_CATEGORIES, type AIBroll, type AICaption, type AIMusic, type AISceneRemoval, type AISfx, type AiQualityCategory, type AiQualityScoresV2 } from "@/lib/validations/ai-timeline";
import { clamp0to100, scoreCaptions, scorePacing } from "../ai-edit-quality-scoring";
import { scoreVisualVariety } from "./variety-ledger";
import type { DirectorAgentId, DirectorIterationEntry, VarietyLedger } from "./types";

// AI Video Director (2026-08-07) — the 10-category quality rubric (TASK
// 12 in the approved plan; category set realigned 2026-08-07, TASK 10 of
// the quality-upgrade pass — see aiQualityScoresV2Schema's own doc
// comment in validations/ai-timeline.ts for the full rename/rationale).
// 7 categories are scored HERE, deterministically, with zero LLM call
// (captions/broll/music/sfx/zoom/visualVariety/editingRhythm); 3 require
// genuine judgment (hook/retention/story) and come from the Quality
// Reviewer agent's own reviewQuality() call (director/orchestrator.ts
// wires that call and passes its result in).

export interface DeterministicScores {
  captionScore: number;
  brollScore: number;
  musicScore: number;
  sfxScore: number;
  zoomScore: number;
  visualVarietyScore: number;
  editingRhythmScore: number;
}

// TASK 10 — zoom is now scored deterministically rather than folded into
// the LLM's judged categories. Two honest, structural signals: (1) count
// reasonableness (loose, not a hard target like b-roll density — every
// Visuals-agent call already hard-caps proposals at "0-5 total" regardless
// of video length, so this only penalizes genuine outliers well beyond
// what that cap alone would allow); (2) named-style diversity — every
// zoom using the identical style reads as monotonous regardless of count,
// a real signal distinct from the whole-ledger visualVarietyScore (which
// mixes zoom/transition/sticker/broll together) — this isolates JUST the
// zoom dimension of that.
export function scoreZoomDeterministic(zoom: ReasoningZoomItem[], sourceDurationMs: number): number {
  if (zoom.length === 0) return 100; // zero zoom is a valid choice for calm content
  const minutes = Math.max(sourceDurationMs, 1) / 60_000;
  const reasonableMax = Math.max(5, Math.ceil(minutes * 3));
  const countScore = zoom.length <= reasonableMax ? 100 : clamp0to100(100 - (zoom.length - reasonableMax) * 15);

  const namedStyles = zoom.map((z) => z.style).filter((s): s is NonNullable<typeof s> => !!s);
  const diversityScore = namedStyles.length <= 1 ? 100 : clamp0to100((new Set(namedStyles).size / namedStyles.length) * 100);

  return clamp0to100(countScore * 0.5 + diversityScore * 0.5);
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
  zoom: ReasoningZoomItem[];
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
    musicScore: scoreMusicDeterministic(input.music),
    sfxScore: scoreSfxDeterministic(input.sfx, input.sfxMaxPer10s),
    zoomScore: scoreZoomDeterministic(input.zoom, input.sourceDurationMs),
    visualVarietyScore: scoreVisualVariety(input.varietyLedger),
    editingRhythmScore: input.captions.length > 0 ? scorePacing(input.sceneRemoval, input.captions, input.sourceDurationMs) : 100,
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
  retentionScore: number;
  storyScore: number;
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
    retention: judged.retentionScore,
    captions: deterministic.captionScore,
    broll: deterministic.brollScore,
    music: deterministic.musicScore,
    sfx: deterministic.sfxScore,
    zoom: deterministic.zoomScore,
    story: judged.storyScore,
    visualVariety: deterministic.visualVarietyScore,
    editingRhythm: deterministic.editingRhythmScore,
  };
  const overallScore = computeOverallScore(perCategory, weights);
  const weakFromDeterministic = AI_QUALITY_CATEGORIES.filter((c) => perCategory[c] < DETERMINISTIC_WEAK_THRESHOLD);
  const weakCategoriesFinal = Array.from(new Set([...weakFromDeterministic, ...judged.weakCategories]));

  return {
    captionScore: deterministic.captionScore,
    brollScore: deterministic.brollScore,
    musicScore: deterministic.musicScore,
    sfxScore: deterministic.sfxScore,
    zoomScore: deterministic.zoomScore,
    visualVarietyScore: deterministic.visualVarietyScore,
    editingRhythmScore: deterministic.editingRhythmScore,
    hookScore: judged.hookScore,
    retentionScore: judged.retentionScore,
    storyScore: judged.storyScore,
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
  retention: ["story"],
  captions: ["captions"],
  broll: ["visuals"],
  music: ["audio"],
  sfx: ["audio"],
  zoom: ["visuals"],
  story: ["story", "captions"],
  visualVariety: ["visuals"],
  editingRhythm: ["visuals"],
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
