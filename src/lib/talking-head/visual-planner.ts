import { generateScript } from "@/lib/generation";
import type { GenerationContext } from "@/lib/generation";
import type { SceneVisualType } from "@/generated/prisma/client";

// Milestone 11 Part 4 — AI Visual Planner. groupSegmentsIntoScenes() is the
// literal LLM-planned replacement for lib/scenes/engine.ts's deterministic
// splitScriptIntoSceneTexts() — same role (turn transcript-shaped text into
// Scene rows), different input (a per-sentence visual plan instead of
// [HOOK]/[BODY]/[CTA] markers). Nothing downstream of Scene creation needs
// to know which path produced the rows.

export const VISUAL_TYPES = [
  "FACE_ONLY",
  "B_ROLL",
  "IMAGE",
  "LOGO",
  "SCREENSHOT",
  "WEBSITE",
  "GRAPH",
  "CHART",
  "ICON",
  "ANIMATION",
  "TEXT_OVERLAY",
] as const satisfies readonly SceneVisualType[];

const VISUAL_TYPE_SET = new Set<string>(VISUAL_TYPES);

export interface VisualPlanInput {
  order: number;
  text: string;
  tags: string[];
  isHook: boolean;
  isCTA: boolean;
}

export function buildVisualPlanPrompt(segments: VisualPlanInput[]): string {
  const allowed = VISUAL_TYPES.join(", ");
  const lines = [
    "You are planning the visual treatment for each sentence of a talking-head marketing video.",
    `For EACH numbered sentence below, choose exactly ONE visual type from this fixed list: ${allowed}.`,
    "FACE_ONLY means the speaker keeps talking on camera with no overlay — use it for plain narration with no concrete visual cue.",
    "Respond with exactly one line per sentence, in order, in the format:",
    "<n>: <VISUAL_TYPE>",
    "",
    "Sentences:",
  ];
  for (const seg of segments) {
    const tagHint = seg.tags.length > 0 ? ` [tags: ${seg.tags.join(", ")}]` : "";
    const cueHint = seg.isHook ? " [hook]" : seg.isCTA ? " [cta]" : "";
    lines.push(`${seg.order + 1}.${tagHint}${cueHint} ${seg.text}`);
  }
  return lines.join("\n");
}

// Tolerant of a model that drifts from the requested format or names a
// visual type outside the fixed list — unmatched/invalid lines fall back to
// FACE_ONLY (the safe default: keep the speaker on camera rather than
// inventing an overlay). Always returns exactly `count` entries.
export function parseVisualPlanResponse(raw: string, count: number): SceneVisualType[] {
  const byIndex = new Map<number, SceneVisualType>();
  const lineRe = /^\s*(\d+)\s*[:.)]\s*([A-Z_]+)/gm;
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(raw)) !== null) {
    const index = Number(match[1]) - 1;
    const candidate = match[2].toUpperCase();
    if (index < 0 || index >= count) continue;
    if (VISUAL_TYPE_SET.has(candidate)) {
      byIndex.set(index, candidate as SceneVisualType);
    }
  }
  return Array.from({ length: count }, (_, i) => byIndex.get(i) ?? "FACE_ONLY");
}

export interface VisualPlanResult {
  visualTypes: SceneVisualType[];
  prompt: string;
}

export async function runVisualPlanningBatch(
  segments: VisualPlanInput[],
  context?: GenerationContext
): Promise<VisualPlanResult> {
  const prompt = buildVisualPlanPrompt(segments);
  const result = await generateScript({ prompt, contentLanguage: "EN" }, context, "talking_head_visual_plan");
  return { visualTypes: parseVisualPlanResponse(result.text, segments.length), prompt };
}

export interface SegmentForGrouping {
  id: string;
  order: number;
  text: string;
  startMs: number;
  endMs: number;
  paragraphIndex: number;
}

interface GroupedSceneBuilder {
  order: number;
  text: string;
  visualType: SceneVisualType;
  startMs: number;
  endMs: number;
  segmentIds: string[];
}

export interface GroupedScene {
  order: number;
  text: string;
  visualType: SceneVisualType;
  durationSeconds: number;
  segmentIds: string[];
}

// Merges contiguous segments into one Scene whenever BOTH their visual type
// AND their paragraph index match the previous segment — a new scene starts
// the moment either the AI Visual Planner's chosen treatment changes, or the
// silence-detected paragraph boundary (lib/transcription/segmentation.ts)
// falls between them. Segments must already be in `order`.
export function groupSegmentsIntoScenes(
  segments: SegmentForGrouping[],
  visualTypes: SceneVisualType[]
): GroupedScene[] {
  const builders: GroupedSceneBuilder[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const visualType = visualTypes[i] ?? "FACE_ONLY";
    const current = builders[builders.length - 1];

    const sameGroup =
      current !== undefined &&
      current.visualType === visualType &&
      segments[i - 1]?.paragraphIndex === segment.paragraphIndex;

    if (sameGroup) {
      current.text = `${current.text} ${segment.text}`;
      current.endMs = segment.endMs;
      current.segmentIds.push(segment.id);
    } else {
      builders.push({
        order: builders.length,
        text: segment.text,
        visualType,
        startMs: segment.startMs,
        endMs: segment.endMs,
        segmentIds: [segment.id],
      });
    }
  }

  return builders.map((b) => ({
    order: b.order,
    text: b.text,
    visualType: b.visualType,
    durationSeconds: Math.max(1, Math.round((b.endMs - b.startMs) / 1000)),
    segmentIds: b.segmentIds,
  }));
}
