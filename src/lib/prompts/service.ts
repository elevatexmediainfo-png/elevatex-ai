import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Prompt Studio (Milestone 8) — "Prompt history" logs every prompt a user
// explicitly authors (Script Studio operations, scene image/video/negative
// prompt edits), distinct from GenerationLog (Milestone 6's per-provider
// attempt log). "Prompt templates" are reusable, user-saved starting points.

type Db = Prisma.TransactionClient | typeof prisma;

export interface RecordPromptInput {
  userId: string;
  kind: "SCRIPT" | "IMAGE" | "VIDEO" | "NEGATIVE";
  text: string;
  videoProjectId?: string;
  sceneId?: string;
}

export async function recordPrompt(input: RecordPromptInput, db: Db = prisma): Promise<void> {
  if (!input.text.trim()) return;
  await db.promptRecord.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      text: input.text,
      videoProjectId: input.videoProjectId,
      sceneId: input.sceneId,
    },
  });
}

export async function listPromptHistory(
  userId: string,
  kind: "SCRIPT" | "IMAGE" | "VIDEO" | "NEGATIVE" | undefined,
  limit = 50
) {
  return prisma.promptRecord.findMany({
    where: { userId, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export interface CreatePromptTemplateInput {
  userId: string;
  category: "SCRIPT" | "IMAGE" | "VIDEO";
  title: string;
  promptText: string;
  negativePromptText?: string;
}

export async function createPromptTemplate(input: CreatePromptTemplateInput) {
  return prisma.promptTemplate.create({
    data: {
      userId: input.userId,
      category: input.category,
      title: input.title,
      promptText: input.promptText,
      negativePromptText: input.negativePromptText || null,
    },
  });
}

export async function listPromptTemplates(userId: string, category: "SCRIPT" | "IMAGE" | "VIDEO" | undefined) {
  return prisma.promptTemplate.findMany({
    where: { userId, ...(category ? { category } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

export class InvalidStateError extends Error {}

export async function deletePromptTemplate(userId: string, id: string): Promise<void> {
  const claim = await prisma.promptTemplate.deleteMany({ where: { id, userId } });
  if (claim.count === 0) throw new InvalidStateError("Prompt template not found.");
}

export interface PromptAnalyticsRow {
  kind: "SCRIPT" | "IMAGE" | "VIDEO" | "NEGATIVE";
  count: number;
  avgLength: number;
}

// Milestone 10 Part 7 — Prompt Analytics. Derived entirely from PromptRecord
// (every recordPrompt() call, including the before/after pair
// runPromptOptimization() writes — see lib/prompts/optimizer.ts) rather than
// a separate counters table, so it can never drift from what was actually
// recorded.
export async function getPromptAnalytics(userId: string, since?: Date): Promise<PromptAnalyticsRow[]> {
  const records = await prisma.promptRecord.findMany({
    where: { userId, ...(since ? { createdAt: { gte: since } } : {}) },
    select: { kind: true, text: true },
  });

  const byKind = new Map<string, { count: number; totalLength: number }>();
  for (const r of records) {
    const entry = byKind.get(r.kind) ?? { count: 0, totalLength: 0 };
    entry.count += 1;
    entry.totalLength += r.text.length;
    byKind.set(r.kind, entry);
  }

  return Array.from(byKind.entries()).map(([kind, { count, totalLength }]) => ({
    kind: kind as PromptAnalyticsRow["kind"],
    count,
    avgLength: Math.round(totalLength / count),
  }));
}
