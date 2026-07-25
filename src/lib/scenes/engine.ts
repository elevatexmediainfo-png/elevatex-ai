import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { splitScriptIntoScenes } from "@/lib/creative/scene-split";
import { MAX_VIDEO_GENERATION_TOTAL_SECONDS } from "@/lib/video-generation-limits";

const SCENE_SPLIT_CLIP_DURATION_SECONDS = 8; // Veo Lite's confirmed fixed real output length (Phase 2/3a)

// Scene Engine — decomposes a project's generated script into independently
// renderable scenes, and tracks their aggregate progress. Scene creation
// happens exactly once per project, right after script generation (status
// SCRIPT_READY) — see app/api/videos/route.ts's POST handler — so scenes are
// editable in the Studio's Scene Editor (Milestone 8) before the user ever
// confirms render. They start in DRAFT and only become render-eligible
// (PENDING) when enqueueRenderableScenes() runs, at confirm-render time.

type Db = Prisma.TransactionClient | typeof prisma;

const MAX_SCENES = 3;
const MIN_SCENE_DURATION_SECONDS = 3;

// The LLM/mock script generator formats output as [HOOK]/[BODY]/[CTA]
// sections (see lib/ai/prompt-engine.ts) — split on those markers first.
// Falls back to paragraph breaks, then to a single scene, so an edited or
// unusually-formatted script still renders instead of failing outright.
// Deterministic by design (no extra LLM call) — easily replaced later by an
// LLM-based scene planner without touching anything downstream of this.
export function splitScriptIntoSceneTexts(script: string, maxScenes = MAX_SCENES): string[] {
  const trimmed = script.trim();
  if (!trimmed) return [];

  const markerSplit = trimmed
    .split(/\[(?:HOOK|BODY|CTA)\]/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (markerSplit.length > 1) return markerSplit.slice(0, maxScenes);

  const paragraphSplit = trimmed
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (paragraphSplit.length > 1) return paragraphSplit.slice(0, maxScenes);

  return [trimmed];
}

// Splits the template's total duration across scenes proportionally to text
// length, with a floor per scene so no scene renders an unreasonably short
// clip. The last scene absorbs any rounding remainder so the sum is exact.
export function allocateSceneDurations(
  texts: string[],
  totalDurationSeconds: number,
  minPerScene = MIN_SCENE_DURATION_SECONDS
): number[] {
  if (texts.length === 0) return [];
  if (texts.length === 1) return [Math.max(totalDurationSeconds, minPerScene)];

  const lengths = texts.map((t) => t.length);
  const totalLength = lengths.reduce((sum, len) => sum + len, 0) || 1;
  const allocations = lengths.map((len) =>
    Math.max(minPerScene, Math.round((len / totalLength) * totalDurationSeconds))
  );

  const sumExceptLast = allocations.slice(0, -1).reduce((sum, n) => sum + n, 0);
  allocations[allocations.length - 1] = Math.max(minPerScene, totalDurationSeconds - sumExceptLast);
  return allocations;
}

export interface SceneDefaults {
  negativePrompt: string;
  backgroundMusicUrl: string;
}

export interface ScriptProject {
  id: string;
  generatedScript: string;
  templateDurationSeconds: number;
  /** Needed only for the scene-split branch below (its LLM call is logged/attributed per-user, same as every other generateScript() call site). */
  userId?: string;
  /** Template.useSceneSplit — selects the scene-creation strategy. Defaults to the original deterministic splitter when omitted, so every existing caller (and every existing template) is unaffected. */
  useSceneSplit?: boolean;
}

// Idempotent against an empty scene list, but NOT against re-calling on a
// project that already has scenes — callers must only invoke this once
// (guarded by the DRAFT -> SCRIPT_READY status transition in app/api/videos/route.ts).
// New scenes default to SceneStatus.DRAFT (the Prisma schema default) —
// editable in the Scene Editor, not yet render-eligible.
export async function createScenesFromScript(
  project: ScriptProject,
  defaults: SceneDefaults,
  db: Db = prisma
): Promise<number> {
  if (project.useSceneSplit) {
    return createScenesFromSplit(project, defaults, db);
  }

  const texts = splitScriptIntoSceneTexts(project.generatedScript);
  if (texts.length === 0) return 0;

  const durations = allocateSceneDurations(texts, project.templateDurationSeconds);

  await db.scene.createMany({
    data: texts.map((text, i) => ({
      videoProjectId: project.id,
      order: i,
      prompt: text,
      // Seeded from the scene's own text but independently editable from
      // here on (Milestone 8 subtitle editing) — render uses whatever the
      // current value is, never re-derives it from `prompt`.
      subtitleText: text,
      negativePrompt: defaults.negativePrompt || null,
      durationSeconds: durations[i],
      backgroundMusicUrl: defaults.backgroundMusicUrl || null,
    })),
  });

  return texts.length;
}

// AI Video reconciliation Step 1 — the LLM-based alternative to
// splitScriptIntoSceneTexts() above, for Template.useSceneSplit templates.
// Reuses lib/creative/scene-split.ts completely unchanged (already proven
// live in AI Video Phase 3a): each returned scene becomes one Scene row at a
// fixed 8s (Veo Lite's real, non-configurable output length — matching what
// Veo actually produces regardless of what's requested, unlike the
// proportional-allocation durations the deterministic splitter computes for
// the old flow). textOverlays are attached to their target scene's
// subtitleText — the minimal reuse of System A's existing caption storage,
// NOT auto-burned into the merged video (confirmed: processMergeJob() never
// reads subtitleText/subtitleKey) — deliberately not a new overlay concept;
// making it render as a bold marketing graphic instead of a caption is a
// timeline/Export-rendering question, out of scope here.
async function createScenesFromSplit(
  project: ScriptProject,
  defaults: SceneDefaults,
  db: Db
): Promise<number> {
  const split = await splitScriptIntoScenes(project.generatedScript, project.userId ?? "");
  if (split.scenes.length === 0) return 0;

  // Hard cap (2026-07-24) — the LLM freely decides scene count here (real,
  // observed range: 3-5), which at a fixed 8s/scene could previously reach
  // 24-40s total, over MAX_VIDEO_GENERATION_TOTAL_SECONDS. Trimmed to
  // however many whole scenes actually fit, same reasoning as FILM's
  // trimScenesToTotalDuration() — a real, deterministic enforcement, not
  // just a prompt instruction to the LLM.
  const maxScenesForCap = Math.max(1, Math.floor(MAX_VIDEO_GENERATION_TOTAL_SECONDS / SCENE_SPLIT_CLIP_DURATION_SECONDS));
  const cappedScenes = split.scenes.slice(0, maxScenesForCap);

  await db.scene.createMany({
    data: cappedScenes.map((scene, i) => {
      const overlay = split.textOverlays.find((o) => o.afterSceneNumber === scene.sceneNumber);
      return {
        videoProjectId: project.id,
        order: i,
        prompt: scene.visualPrompt,
        videoPrompt: scene.visualPrompt,
        imagePrompt: scene.visualPrompt,
        // No overlay for most scenes — left as an EMPTY STRING, deliberately
        // not null: pipeline.ts's subtitle build falls back to `scene.prompt`
        // whenever subtitleText is null (correct for the old flow, where
        // `prompt` IS the spoken line), but `prompt` here is a VISUAL
        // description a viewer should never see rendered as on-screen text.
        // An empty string skips that fallback (only `??` triggers on
        // null/undefined) and produces an inert, empty caption cue instead.
        subtitleText: overlay?.text ?? "",
        negativePrompt: defaults.negativePrompt || null,
        durationSeconds: SCENE_SPLIT_CLIP_DURATION_SECONDS,
        backgroundMusicUrl: defaults.backgroundMusicUrl || null,
      };
    }),
  });

  return cappedScenes.length;
}

// Creates one RenderJob per scene that isn't already COMPLETED (the caching
// requirement — a re-render only ever (re-)queues non-completed scenes).
// Resets those scenes to PENDING so a previously FAILED scene is retried.
export async function enqueueRenderableScenes(
  videoProjectId: string,
  maxAttempts: number,
  db: Db = prisma
): Promise<number> {
  const scenes = await db.scene.findMany({
    where: { videoProjectId, status: { not: "COMPLETED" } },
    select: { id: true },
  });
  if (scenes.length === 0) return 0;

  await db.scene.updateMany({
    where: { id: { in: scenes.map((s) => s.id) } },
    data: { status: "PENDING", errorMessage: null },
  });

  await db.renderJob.createMany({
    data: scenes.map((s) => ({
      videoProjectId,
      sceneId: s.id,
      maxAttempts,
      payload: {},
    })),
  });

  return scenes.length;
}

export async function listScenes(videoProjectId: string) {
  return prisma.scene.findMany({ where: { videoProjectId }, orderBy: { order: "asc" } });
}

// Scene Editor's "add scene" — appended after the current last scene. Only
// meaningful pre-render (callers gate on project status); a manually-added
// scene has no AI-generated text yet, so `prompt` starts as a short
// placeholder the user is expected to fill in via the Scene Editor.
export async function appendScene(
  videoProjectId: string,
  defaults: SceneDefaults,
  db: Db = prisma
) {
  const last = await db.scene.findFirst({ where: { videoProjectId }, orderBy: { order: "desc" } });
  const order = last ? last.order + 1 : 0;
  const durationSeconds = MIN_SCENE_DURATION_SECONDS + 2;

  const prompt = "New scene — describe what should happen here.";
  return db.scene.create({
    data: {
      videoProjectId,
      order,
      prompt,
      subtitleText: prompt,
      negativePrompt: defaults.negativePrompt || null,
      durationSeconds,
      backgroundMusicUrl: defaults.backgroundMusicUrl || null,
    },
  });
}

// Scene Editor's "delete scene" — re-normalizes the remaining scenes' order
// to a contiguous 0..n-1 sequence so the @@unique([videoProjectId, order])
// constraint and the merge step's ordering both stay correct.
export async function deleteSceneAndRenormalize(
  videoProjectId: string,
  sceneId: string,
  db: Db = prisma
): Promise<void> {
  await db.scene.delete({ where: { id: sceneId } });
  const remaining = await db.scene.findMany({ where: { videoProjectId }, orderBy: { order: "asc" } });
  await Promise.all(
    remaining.map((scene, index) =>
      scene.order === index ? null : db.scene.update({ where: { id: scene.id }, data: { order: index } })
    )
  );
}

// Scene Editor's drag-and-drop reorder — `orderedSceneIds` is the FULL set of
// the project's scene ids in their new order. Validated by the caller to
// belong to this project before being passed in.
export async function reorderScenes(
  orderedSceneIds: string[],
  db: Db = prisma
): Promise<void> {
  await Promise.all(
    orderedSceneIds.map((id, index) => db.scene.update({ where: { id }, data: { order: index } }))
  );
}

export interface SceneProgress {
  percent: number;
  total: number;
  completed: number;
  failed: number;
}

export function computeProgress(scenes: { status: string }[]): SceneProgress {
  const total = scenes.length;
  const completed = scenes.filter((s) => s.status === "COMPLETED").length;
  const failed = scenes.filter((s) => s.status === "FAILED").length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { percent, total, completed, failed };
}
