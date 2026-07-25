import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildWordLevelVtt, type TimedWord } from "@/lib/scenes/subtitle";
import { getStorageProvider } from "@/lib/providers/storage";

// Caption Engine (Milestone 9) — word-level captions, additive alongside
// (never replacing) Scene.subtitleText/subtitleKey. Auto-timing is a
// deterministic, proportional-to-word-length split (same pattern as
// lib/scenes/engine.ts's allocateSceneDurations) — no speech-to-text
// provider needed, matching lib/scenes/subtitle.ts's existing approach.

type Db = Prisma.TransactionClient | typeof prisma;

const MIN_WORD_MS = 150;

export interface GeneratedWord {
  text: string;
  startMs: number;
  endMs: number;
  emphasis?: string;
  highlightColor?: string;
}

// Pure — splits `text` into words and allocates each a duration
// proportional to its character length out of the scene's total duration,
// with a floor per word so no word's cue is imperceptibly short. The last
// word absorbs any rounding remainder so the total is exact.
export function generateWordTimings(text: string, durationMs: number, minWordMs = MIN_WORD_MS): GeneratedWord[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length === 1) return [{ text: words[0], startMs: 0, endMs: Math.max(durationMs, minWordMs) }];

  const lengths = words.map((w) => w.length);
  const totalLength = lengths.reduce((sum, len) => sum + len, 0) || 1;
  const allocations = lengths.map((len) => Math.max(minWordMs, Math.round((len / totalLength) * durationMs)));

  const sumExceptLast = allocations.slice(0, -1).reduce((sum, n) => sum + n, 0);
  allocations[allocations.length - 1] = Math.max(minWordMs, durationMs - sumExceptLast);

  let cursorMs = 0;
  return words.map((w, i) => {
    const startMs = cursorMs;
    const endMs = startMs + allocations[i];
    cursorMs = endMs;
    return { text: w, startMs, endMs };
  });
}

async function rebuildSceneSubtitle(sceneId: string, words: TimedWord[], db: Db) {
  const storage = await getStorageProvider();
  const vtt = buildWordLevelVtt(words);
  const text = words.map((w) => w.text).join(" ");
  const subtitleObj = await storage.upload({
    key: `scenes/${sceneId}/subtitle.vtt`,
    data: Buffer.from(vtt, "utf-8"),
    contentType: "text/vtt",
  });
  await db.scene.update({ where: { id: sceneId }, data: { subtitleText: text, subtitleKey: subtitleObj.key } });
}

export class InvalidStateError extends Error {}

// Milestone 11 Part 7 — Smart Captions. A Talking Head scene already has
// real, speech-aligned word timestamps (Part 2's Whisper transcription),
// far more accurate than the proportional-to-character-length estimate
// below — reused here rather than re-estimating something we already know
// exactly. Words inside a hook/CTA-tagged segment (Part 3's analysis) get a
// default emphasis + the user's Brand Kit color, satisfying "word
// highlight" with no separate styling step. Falls back to the estimate for
// GENERATED-flow scenes (no transcript) — same function, same call sites,
// unchanged behavior there.
async function deriveSceneWordTimings(
  scene: { id: string; videoProjectId: string; subtitleText: string | null; prompt: string; durationSeconds: number },
  db: Db
): Promise<GeneratedWord[]> {
  const segments = await db.transcriptSegment.findMany({
    where: { sceneId: scene.id },
    orderBy: { order: "asc" },
  });

  if (segments.length > 0) {
    const project = await db.videoProject.findUnique({
      where: { id: scene.videoProjectId },
      select: { userId: true },
    });
    const brandKit = project
      ? await db.brandKit.findUnique({ where: { userId: project.userId }, select: { primaryColor: true } })
      : null;

    const sceneStartMs = segments[0].startMs;
    const words: GeneratedWord[] = [];
    for (const seg of segments) {
      const analysis = seg.analysis as { isHook?: boolean; isCTA?: boolean } | null;
      const isEmphasized = Boolean(analysis?.isHook || analysis?.isCTA);
      const timings = (seg.wordTimings as { word: string; startMs: number; endMs: number }[] | null) ?? [];
      for (const w of timings) {
        words.push({
          text: w.word,
          startMs: Math.max(0, w.startMs - sceneStartMs),
          endMs: Math.max(0, w.endMs - sceneStartMs),
          emphasis: isEmphasized ? "bold" : undefined,
          highlightColor: isEmphasized ? brandKit?.primaryColor ?? undefined : undefined,
        });
      }
    }
    if (words.length > 0) return words;
  }

  return generateWordTimings(scene.subtitleText ?? scene.prompt, scene.durationSeconds * 1000);
}

// Idempotent — returns the existing CaptionBlock+words if present, otherwise
// seeds one from the scene's current subtitleText (or prompt, if subtitles
// haven't rendered yet) and duration.
export async function ensureCaptionBlock(sceneId: string, db: Db = prisma) {
  const existing = await db.captionBlock.findUnique({
    where: { sceneId },
    include: { words: { orderBy: { order: "asc" } } },
  });
  if (existing) return existing;

  const scene = await db.scene.findUniqueOrThrow({ where: { id: sceneId } });
  const words = await deriveSceneWordTimings(scene, db);

  const block = await db.captionBlock.create({
    data: {
      sceneId,
      videoProjectId: scene.videoProjectId,
      words: { createMany: { data: words.map((w, i) => ({ order: i, ...w })) } },
    },
    include: { words: { orderBy: { order: "asc" } } },
  });
  return block;
}

// AI Editing's "Regenerate subtitles" — recomputes word timings from
// scratch from the scene's CURRENT subtitleText/duration (or its
// transcript, if one exists) and rebuilds the rendered VTT. Deterministic,
// no provider call, so this runs synchronously rather than through the
// render queue.
export async function regenerateCaptionWords(sceneId: string) {
  return prisma.$transaction(async (tx) => {
    const scene = await tx.scene.findUniqueOrThrow({ where: { id: sceneId } });
    const words = await deriveSceneWordTimings(scene, tx);

    const block = await tx.captionBlock.upsert({
      where: { sceneId },
      create: { sceneId, videoProjectId: scene.videoProjectId },
      update: {},
    });
    await tx.captionWord.deleteMany({ where: { captionBlockId: block.id } });
    await tx.captionWord.createMany({ data: words.map((w, i) => ({ captionBlockId: block.id, order: i, ...w })) });

    await rebuildSceneSubtitle(sceneId, words, tx);

    return tx.captionBlock.findUniqueOrThrow({
      where: { id: block.id },
      include: { words: { orderBy: { order: "asc" } } },
    });
  });
}

export interface UpdateCaptionWordsInput {
  text: string;
  startMs: number;
  endMs: number;
  emphasis?: string;
  highlightColor?: string;
}

// Caption Editor's save — replaces the word list with the user's edits
// (word-level editing + manually-adjusted timing) and an optional style
// preset, then rebuilds the scene's actual rendered subtitle artifact so the
// edits reach the render pipeline, not just this table.
export async function updateCaptionWords(
  videoProjectId: string,
  sceneId: string,
  words: UpdateCaptionWordsInput[],
  stylePresetId: string | undefined
) {
  return prisma.$transaction(async (tx) => {
    const scene = await tx.scene.findFirst({ where: { id: sceneId, videoProjectId } });
    if (!scene) throw new InvalidStateError("Scene not found in this project.");

    const block = await tx.captionBlock.upsert({
      where: { sceneId },
      create: { sceneId, videoProjectId, style: stylePresetId ? { stylePresetId } : undefined },
      update: { style: stylePresetId ? { stylePresetId } : undefined },
    });
    await tx.captionWord.deleteMany({ where: { captionBlockId: block.id } });
    await tx.captionWord.createMany({ data: words.map((w, i) => ({ captionBlockId: block.id, order: i, ...w })) });

    await rebuildSceneSubtitle(sceneId, words, tx);

    return tx.captionBlock.findUniqueOrThrow({
      where: { id: block.id },
      include: { words: { orderBy: { order: "asc" } } },
    });
  });
}

export async function listCaptionBlock(videoProjectId: string, sceneId: string) {
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, videoProjectId } });
  if (!scene) throw new InvalidStateError("Scene not found in this project.");
  return ensureCaptionBlock(sceneId);
}
