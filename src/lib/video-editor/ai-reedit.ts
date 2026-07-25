import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/observability/logger";
import { planReedit } from "@/lib/generation/reasoning";
import { pickBestStockResult } from "./ai-broll-resolver";
import { searchStockMedia, materializeStockAsset } from "@/lib/providers/stock-media/search-service";
import { DEFAULT_CLIP_TRANSFORM } from "./transform";
import { getOwnedProject } from "./projects";
import { InvalidStateError } from "./errors";
import type { AIReeditResponse } from "@/lib/validations/ai-reedit";

// Phase 12 Module 9 — Prompt-based re-edit orchestration. Mirrors
// ai-edit-jobs.ts's own "gather real context -> call the reasoning
// provider -> resolve any asset the response needs -> return a clean
// result" shape, just scoped to ONE clip and ONE instruction instead of a
// whole pipeline job — deliberately NOT modeled as an AiEditJob row
// (no multi-stage worker/poll needed; a re-edit interpretation is one
// synchronous request/response, same class of call as any other
// Generation Engine invocation elsewhere in this app).

export interface ReeditClipInput {
  projectId: string;
  userId: string;
  clipId: string;
  instruction: string;
}

// The response the API route returns to the client. `response` is exactly
// what the model produced (validated against aiReeditResponseSchema);
// `resolvedAssetId`/`resolutionNote` are ONLY populated when
// response.action === "change_asset" — resolution happens HERE (stock
// search needs server-only provider credentials) so the client only ever
// receives a ready-to-apply real asset id, or an honest failure reason,
// never a raw search query it would have to resolve itself.
export interface ReeditClipResult {
  response: AIReeditResponse;
  resolvedAssetId?: string;
  resolutionNote?: string;
}

export async function reeditClip(input: ReeditClipInput): Promise<ReeditClipResult> {
  await getOwnedProject(input.userId, input.projectId);

  const clip = await prisma.editorClip.findFirst({ where: { id: input.clipId, projectId: input.projectId } });
  if (!clip) throw new InvalidStateError("Clip not found.");

  const transitions = await prisma.editorTransition.findMany({
    where: { projectId: input.projectId, OR: [{ clipAId: clip.id }, { clipBId: clip.id }] },
  });

  const transform = (clip.transform as unknown as typeof DEFAULT_CLIP_TRANSFORM | null) ?? DEFAULT_CLIP_TRANSFORM;
  const content = clip.content as { text?: string; reveal?: { mode: string; unitDurationMs: number; style: string; highlightColor: string } } | null;

  const response = await planReedit(
    {
      instruction: input.instruction,
      clip: {
        durationMs: clip.durationMs,
        transform: {
          scale: transform.scale.value,
          position: transform.position.value,
          rotation: transform.rotation.value,
          opacity: transform.opacity.value,
        },
        hasZoomKeyframes: !!transform.scale.keyframes && transform.scale.keyframes.length > 0,
        caption: content?.text ? { text: content.text, reveal: content.reveal ?? null } : null,
        adjacentTransitions: transitions.map((t) => ({
          side: t.clipAId === clip.id ? ("after" as const) : ("before" as const),
          type: t.type,
          durationMs: t.durationMs,
        })),
      },
    },
    { userId: input.userId }
  );

  if (response.response.action !== "change_asset") {
    return { response: response.response };
  }

  // Resolve the search query into a real EditorAsset — same
  // searchStockMedia/pickBestStockResult/materializeStockAsset path
  // Module 5/6 already established, reused verbatim rather than a third
  // copy of the same scoring/materialize logic. "Don't fake it": a miss
  // is returned as a clear resolutionNote, never a forced/placeholder id.
  try {
    const query = response.response.searchQuery;
    const [videoOutcomes, imageOutcomes] = await Promise.all([
      searchStockMedia("STOCK_MEDIA", query, { type: "video", perPage: 5 }),
      searchStockMedia("STOCK_MEDIA", query, { type: "image", perPage: 5 }),
    ]);
    const picked = pickBestStockResult([...videoOutcomes.outcomes, ...imageOutcomes.outcomes], "VIDEO", query);
    if (!picked) {
      return { response: response.response, resolutionNote: `No stock results found for "${query}".` };
    }
    const materialized = await materializeStockAsset(input.userId, picked.providerId, "STOCK_MEDIA", picked.result);
    return { response: response.response, resolvedAssetId: materialized.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Asset resolution failed.";
    logger.error({ err, clipId: input.clipId }, "[ai reedit] change_asset resolution failed");
    return { response: response.response, resolutionNote: message };
  }
}
