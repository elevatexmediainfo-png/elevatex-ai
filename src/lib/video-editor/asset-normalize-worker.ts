import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/observability/logger";
import { getStorageProvider } from "@/lib/providers/storage";
import { decideNormalization, normalizeVideoBuffer } from "./normalization";
import { probeMediaFile } from "./ffprobe-exec";
import { generateVideoFilmstrip } from "./thumbnails";

// Upload normalization (2026-07-19) — mirrors export-worker.ts's own
// claim/process/drain shape exactly (atomic findFirst+updateMany claim,
// a per-job function, a drainX(concurrency) loop) for consistency with
// this codebase's other two FFmpeg-heavy background workers.

// Real, live-reproduced incident (2026-07-22) — a launch-blocking
// performance investigation ("an 18-second video took ~15 minutes")
// traced to THIS file, not the transcode itself: a direct, isolated
// timing of normalizeVideoBuffer()+generateVideoFilmstrip() on a genuinely
// bad-codec clip (100fps, non-AAC audio, 57Mbps — the exact profile this
// module exists to fix) took 8.21s total for an 8-second clip — fast, not
// the bottleneck. The real bottleneck: storage.download() below has NO
// timeout at all, and EDITOR_NORMALIZE_QUEUE_CONCURRENCY defaults to 1 —
// a single global worker slot. A real, reproducible slow/hung network
// call on ANY ONE upload (confirmed live: an ordinary R2 GetObject that
// should take under 90s instead sat for 80+ minutes making zero
// progress, 0% CPU, in this exact environment) blocks that ONE worker
// slot FOREVER, so EVERY subsequent user's upload — no matter how small
// or fast — queues behind it with no way to ever get processed short of
// a manual server restart. This is very likely the real "15 minutes"
// mechanism: not that any single job is slow, but that a single genuinely
// stuck job silently blocks the entire queue behind it, indefinitely.
// Confirmed the failure mode is real and not just theoretical: this exact
// scenario left 2 real assets permanently stuck at NORMALIZING in this
// environment (one for 80+ minutes) after an unrelated server restart
// killed an in-flight job mid-download, with no code path to ever recover
// them.
//
// Fix, two layers: (1) JOB_TIMEOUT_MS bounds a single job's total work so
// a hung network call fails cleanly (asset -> FAILED, worker slot freed)
// instead of blocking forever; (2) reapStaleNormalizingAssets() recovers
// any asset already stuck past a stale threshold — covers the OTHER real
// failure mode a timeout alone can't catch: the whole Node process (not
// just one async call) getting killed mid-job, e.g. by a real deploy,
// which this session's own established runbook does routinely.
const JOB_TIMEOUT_MS = 5 * 60 * 1000;
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

// Known, accepted limitation: this races `promise`, it doesn't cancel it —
// storage.download()'s underlying S3Client call has no AbortSignal wired
// through the StorageProvider interface today, so a genuinely hung
// download keeps running in the background after this function moves on.
// That's fine for THIS fix's actual goal: the worker loop's `await
// normalizeAssetJob(...)` resolves the instant the timeout wins, freeing
// the single global worker slot for the next job immediately — the queue-
// blocking bug this exists to fix — regardless of what the abandoned
// promise does afterward. The narrow residual risk (the stale download
// eventually resolves and re-runs the rest of the pipeline against an
// asset already marked FAILED) is real but rare — a hung TCP connection
// times out at the OS level within minutes in practice, and every real
// deploy already recycles the process. A full fix would thread a real
// AbortSignal through StorageProvider/S3StorageProvider — a bigger,
// separate change, not needed to close the actual reported bug.
async function withTimeout<R>(promise: Promise<R>, timeoutMs: number, message: string): Promise<R> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Recovers assets orphaned by a killed/restarted process — the ONE thing
// an in-process timeout can never catch, since the timeout's own setTimeout
// dies along with the process that would have fired it. Runs once per
// drainNormalizeQueue() call (i.e. once per poll tick, same cadence the
// queue worker already ticks at) — cheap (one indexed query) and safe to
// run redundantly since it only ever touches rows already stale well past
// any real in-flight job's own JOB_TIMEOUT_MS.
async function reapStaleNormalizingAssets(): Promise<void> {
  const staleBefore = new Date(Date.now() - STALE_THRESHOLD_MS);
  const stale = await prisma.editorAsset.updateMany({
    where: { status: "NORMALIZING", updatedAt: { lt: staleBefore } },
    data: { status: "FAILED" },
  });
  if (stale.count > 0) {
    logger.error({ count: stale.count, staleThresholdMs: STALE_THRESHOLD_MS }, "[asset-normalize] reaped stale NORMALIZING asset(s) — likely orphaned by a killed/restarted process");
  }
}

// Atomic claim — same compare-and-swap shape as exports.ts's
// claimNextExport(): QUEUED_FOR_NORMALIZATION -> NORMALIZING via a
// conditional updateMany, safe under concurrent worker loops for the
// same "not safe for many concurrent PROCESSES, single-instance only"
// reason every other queue in this codebase already documents.
async function claimNextAssetToNormalize() {
  const candidate = await prisma.editorAsset.findFirst({
    where: { status: "QUEUED_FOR_NORMALIZATION" },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;

  const claimed = await prisma.editorAsset.updateMany({
    where: { id: candidate.id, status: "QUEUED_FOR_NORMALIZATION" },
    data: { status: "NORMALIZING" },
  });
  if (claimed.count === 0) return null;

  return prisma.editorAsset.findUnique({ where: { id: candidate.id } });
}

// One job: probe -> decide -> transcode-if-needed -> re-upload (overwrite
// storageKey in place, per the confirmed design — editor preview and
// export both already resolve through this same storageKey/getPublicUrl,
// so overwriting it fixes both surfaces with zero other code changes) ->
// filmstrip (moved here from confirmEditorAssetUpload — generating it
// AFTER normalization means the filmstrip reflects the actual video every
// future playback will decode, not a pre-normalization source that may
// have had a different codec/fps) -> READY.
export async function normalizeAssetJob(assetId: string): Promise<void> {
  const asset = await prisma.editorAsset.findUniqueOrThrow({ where: { id: assetId } });
  const storage = await getStorageProvider();

  try {
    await withTimeout(runNormalizeWork(asset, storage), JOB_TIMEOUT_MS, `Normalization timed out after ${JOB_TIMEOUT_MS}ms`);
  } catch (err) {
    console.error(`[asset-normalize] job failed for ${assetId}:`, err);
    await prisma.editorAsset.update({ where: { id: assetId }, data: { status: "FAILED" } });
  }
}

// Extracted (2026-07-22) so normalizeAssetJob can race the WHOLE thing —
// download, probe, transcode, reupload, filmstrip — against one bounded
// timeout, rather than the timeout only covering whichever single step
// someone remembers to wrap.
async function runNormalizeWork(asset: { id: string; storageKey: string; durationSeconds: number | null }, storage: Awaited<ReturnType<typeof getStorageProvider>>): Promise<void> {
  const originalBuffer = await storage.download(asset.storageKey);
  const probe = await probeMediaFile(originalBuffer);
  const decision = decideNormalization(probe);

  let finalBuffer = originalBuffer;
  if (decision.needsNormalization) {
    console.log(`[asset-normalize] ${asset.id}: transcoding — ${decision.reasons.join("; ")}`);
    finalBuffer = await normalizeVideoBuffer(originalBuffer, decision);
    await storage.upload({ key: asset.storageKey, data: finalBuffer, contentType: "video/mp4" });
  } else {
    console.log(`[asset-normalize] ${asset.id}: skipped — ${decision.reasons.join("; ")}`);
  }

  let filmstripKey: string | null = null;
  let filmstripFrameCount: number | null = null;
  if (asset.durationSeconds) {
    try {
      const filmstrip = await generateVideoFilmstrip(finalBuffer, asset.durationSeconds);
      filmstripKey = `${asset.storageKey}.filmstrip.jpg`;
      await storage.upload({ key: filmstripKey, data: filmstrip.buffer, contentType: "image/jpeg" });
      filmstripFrameCount = filmstrip.frameCount;
    } catch (err) {
      // Best-effort, same non-blocking precedent as the original
      // filmstrip call site this replaced — a filmstrip failure must
      // never leave a real, playable asset stuck un-READY.
      console.error(`[asset-normalize] filmstrip generation failed for ${asset.id}:`, err);
    }
  }

  await prisma.editorAsset.update({
    where: { id: asset.id },
    data: {
      status: "READY",
      ...(filmstripKey ? { filmstripKey, filmstripFrameCount } : {}),
    },
  });
}

export async function drainNormalizeQueue(concurrency: number): Promise<{ processedCount: number }> {
  await reapStaleNormalizingAssets();

  let processedCount = 0;
  let exhausted = false;

  async function worker() {
    while (!exhausted) {
      const job = await claimNextAssetToNormalize();
      if (!job) {
        exhausted = true;
        return;
      }
      await normalizeAssetJob(job.id);
      processedCount++;
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  return { processedCount };
}
