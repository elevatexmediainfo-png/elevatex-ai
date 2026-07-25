import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/observability/logger";

// Real gap fix (2026-07-25) — found live: a FILM scene's per-scene
// generation (generateFilmSceneVideo(), a synchronous HTTP call, not a
// queued RenderJob — see that file's own doc comment for why) has no
// equivalent to export-queue-worker.ts's reapStaleRenderingExports() or
// asset-normalize-worker.ts's reapStaleNormalizingAssets(). A killed/
// restarted process mid-render (this session's own established runbook
// does this routinely — a real deploy is no different) leaves the scene at
// RENDERING forever with nothing left to ever recover it, exactly like
// those two gaps before their own fixes. Confirmed live: two real scenes
// found orphaned this way, one where the underlying video render had
// actually SUCCEEDED (a real seedance2 result, per GenerationLog) but the
// process died before the final upload/persist/status-update could run —
// the video itself is unrecoverable (it only ever existed in that dead
// process's memory), so this can only ever mark the scene FAILED and let
// the user retry, never actually recover the render.
//
// 20 minutes (vs. export's 30 / normalize's 10) — set above the worst real
// per-scene duration observed live (~10 minutes: two failed video-provider
// attempts + one timed-out retry + one successful retry, all real vendor
// latency, not a bug) with real margin, not a guess. Checked against the
// REAL current config during the 2026-07-25 audit: only one VIDEO provider
// (seedance2) is actually eligible for FILM's durations once Sora is
// filtered out, timeoutMs=300000 x 2 retries = 10 real minutes worst case —
// exactly half this threshold. That margin is NOT structurally guaranteed
// though: an admin enabling more VIDEO providers later (each with their own
// timeout x retry budget) could push a genuinely-still-running chain's real
// worst case past 20 minutes. If this reaper ever fired on a request that
// was still genuinely alive, the scene would flip to FAILED while the
// original request keeps running — and scenes/[sceneId]/generate/route.ts's
// own claim guard (`status: { not: "RENDERING" }`) would then let a Retry
// click start a SECOND, real, concurrent generation for the same scene
// (double vendor cost, double credit charge) rather than being blocked by
// it. The GenerationLog cross-check below closes that regardless of how
// the provider chain changes in the future — it directly checks for recent
// real vendor activity instead of assuming a fixed time budget.
const STALE_RENDERING_THRESHOLD_MS = 20 * 60 * 1000;

// A scene attached to a genuinely still-running request has SOME real
// vendor activity (a GenerationLog SUCCESS/FAILURE row, written the moment
// each attempt completes) within any reasonable multiple of a single
// attempt's own timeout — even the current real worst case (seedance2,
// 300000ms) fits inside this with room to spare. Anything staler than this
// AND past the threshold above genuinely has nothing left working on it.
const RECENT_ACTIVITY_WINDOW_MS = 10 * 60 * 1000;

export async function reapStaleRenderingScenes(): Promise<void> {
  const staleBefore = new Date(Date.now() - STALE_RENDERING_THRESHOLD_MS);
  const candidates = await prisma.scene.findMany({
    where: { status: "RENDERING", updatedAt: { lt: staleBefore } },
    select: { id: true },
  });
  if (candidates.length === 0) return;

  const recentActivityCutoff = new Date(Date.now() - RECENT_ACTIVITY_WINDOW_MS);
  const recentlyActive = await prisma.generationLog.findMany({
    where: { sceneId: { in: candidates.map((c) => c.id) }, createdAt: { gt: recentActivityCutoff } },
    select: { sceneId: true },
    distinct: ["sceneId"],
  });
  const activeSceneIds = new Set(recentlyActive.map((r) => r.sceneId));
  const trulyOrphaned = candidates.filter((c) => !activeSceneIds.has(c.id));
  if (trulyOrphaned.length === 0) return;

  const stale = await prisma.scene.updateMany({
    where: { id: { in: trulyOrphaned.map((s) => s.id) } },
    data: {
      status: "FAILED",
      errorMessage:
        "Generation was interrupted before it could finish (likely a server restart during a real, multi-minute render) — not a failure of the render itself. Please retry.",
      renderProgress: Prisma.JsonNull,
    },
  });
  if (stale.count > 0) {
    logger.error(
      { count: stale.count, staleThresholdMs: STALE_RENDERING_THRESHOLD_MS },
      "[film scene reaper] reaped stale RENDERING scene(s) — likely orphaned by a killed/restarted process"
    );
  }
}

const POLL_INTERVAL_MS = 60_000;

const globalForSceneReaper = globalThis as unknown as {
  __elevatexFilmSceneReaperStarted?: boolean;
};

async function pollOnce() {
  try {
    await reapStaleRenderingScenes();
  } catch (err) {
    logger.error({ err }, "[film scene reaper] poll failed");
  }
}

export function startFilmSceneReaper() {
  if (globalForSceneReaper.__elevatexFilmSceneReaperStarted) return;
  globalForSceneReaper.__elevatexFilmSceneReaperStarted = true;

  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, "[film scene reaper] started");
  setInterval(pollOnce, POLL_INTERVAL_MS);
}
