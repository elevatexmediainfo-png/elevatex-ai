import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { requireOwnedFilmProject } from "@/lib/film/access";
import { generateAndPersistFilmScene } from "@/lib/film/generate-scene";

// POST /api/videos/film/[id]/scenes/generate-all — "Approve storyboard &
// generate all scenes" (2026-07-23). The piece connecting character
// generation + storyboard review to actual video generation without
// requiring a click per scene. Reuses generateAndPersistFilmScene() (the
// exact same per-scene logic the single-scene "Generate scene" button
// already uses, including the mock-fallback hard-fail — see that file's own
// comment) for every scene, run as one bounded-concurrency batch
// (FILM_BULK_GENERATE_CONCURRENCY, default 2) rather than either fully
// serial (slow — each Veo call is a genuinely long vendor operation) or
// fully parallel (risks real per-account rate limits/cost bursts). This is
// ONE blocking HTTP call, same shape as the existing Merge route — the
// client polls scenes/progress/route.ts concurrently for real per-scene
// status, the same pattern MergeStep already established for the Merge
// step's own multi-minute wait.
//
// Only targets scenes in DRAFT or FAILED — an already-COMPLETED scene is
// never touched here (regenerating one is a deliberate, separate action via
// the per-scene button, never an implicit side effect of bulk-approve), and
// a scene already RENDERING is left alone rather than double-dispatched —
// this makes a bulk-approve naturally resumable/re-clickable after a
// partial failure, and safe to click without risking firing two concurrent
// real Veo calls at the same scene.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;
  const project = await requireOwnedFilmProject(session.user.id, id);
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Film project not found.", 404);
  }
  // Fresh consts so TS narrows these as non-null inside the worker closures
  // below (a value captured from an outer `let`-like binding across an
  // async-function boundary doesn't automatically keep its narrowed type).
  const userId = session.user.id;
  const ownedProject = project;

  const scenes = await prisma.scene.findMany({ where: { videoProjectId: id }, orderBy: { order: "asc" } });
  if (scenes.length === 0) {
    return apiError("ERR_VALIDATION", "This film has no storyboard yet.", 400);
  }

  // Same "don't pile a second run on top of an in-flight one" reasoning as
  // mergeScenesViaEditor()'s findInFlightMergeExport() — two overlapping
  // bulk-generate calls competing for the same scenes would waste real
  // vendor cost and confuse the progress endpoint.
  if (scenes.some((s) => s.status === "RENDERING")) {
    return apiError("ERR_INVALID_STATE", "Scene generation is already in progress for this film.", 409);
  }

  const pending = scenes.filter((s) => s.status === "DRAFT" || s.status === "FAILED");
  if (pending.length === 0) {
    return apiSuccess({ completed: 0, failed: 0, results: [] });
  }

  const body = await req.json().catch(() => ({}));
  const preferredProviderId = typeof body.preferredProviderId === "string" ? body.preferredProviderId : undefined;

  // Flipped to RENDERING up front, in one write, before any real generation
  // call starts — real, immediately-pollable state for scenes/progress/route.ts,
  // not just a dispatch-order bookkeeping array.
  await prisma.scene.updateMany({
    where: { id: { in: pending.map((s) => s.id) } },
    data: { status: "RENDERING", errorMessage: null },
  });

  const concurrency = await getConfig("FILM_BULK_GENERATE_CONCURRENCY");
  const queue = [...pending];
  const results: { sceneId: string; ok: boolean; code?: string; message?: string }[] = [];

  async function worker() {
    for (;;) {
      const scene = queue.shift();
      if (!scene) return;
      const result = await generateAndPersistFilmScene(userId, ownedProject, scene, preferredProviderId);
      results.push(result.ok ? { sceneId: scene.id, ok: true } : { sceneId: scene.id, ok: false, code: result.code, message: result.message });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, () => worker()));

  const completed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  return apiSuccess({ completed, failed, results });
}
