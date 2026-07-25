import * as Sentry from "@sentry/nextjs";

// Next.js server-startup hook (stable since Next 15, runs once per server
// process). Starting the queue worker here — rather than as a side effect of
// importing some route file — keeps it explicit and out of the request path.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    const { validateEnv } = await import("@/lib/env");
    validateEnv();

    // PAYMENT hard-boot-block (2026-07-23, explicit founder decision after
    // the free-credits exploit fix) — every other misconfiguration only
    // gets the loud-but-non-fatal warning below, but PAYMENT is the one
    // category where "silently degraded" was a real, live exploit (any
    // signed-in user could get free credits/subscriptions). Per-request
    // enforcement already exists independently (getPaymentProvider() throws
    // regardless of this check) — this is real defense-in-depth: a
    // production deployment with no real PAYMENT provider configured now
    // refuses to finish booting at all, rather than serving traffic in a
    // state where every checkout silently 503s. Runs BEFORE the queue
    // workers start so a doomed boot exits as early as possible.
    if (process.env.NODE_ENV === "production") {
      const { isPaymentCheckoutAvailable } = await import("@/lib/providers/payment");
      const paymentReady = await isPaymentCheckoutAvailable();
      if (!paymentReady) {
        const border = "=".repeat(78);
        console.error(
          `\n${border}\n🛑 BOOT REFUSED — no real PAYMENT provider is enabled in production.\n   Every checkout would silently 503 for real users. This is a hard\n   stop, not a warning — enable Razorpay in Admin -> AI Providers (or\n   set NODE_ENV back to a non-production value for local dev/demo)\n   before this server can start. See PROJECT_STATUS.md's 2026-07-23\n   PAYMENT exploit fix for the full incident writeup.\n${border}\n`
        );
        process.exit(1);
      }
    }

    const { startQueueWorker } = await import("@/lib/queue/worker");
    startQueueWorker();

    // Module 10 — a second, independently-tuned poll loop for Export jobs
    // (headless Chromium + FFmpeg), kept separate from the AI-generation
    // render queue above — see export-worker.ts's drainExportQueue doc
    // comment.
    //
    // Fail SOFT here, unlike the PAYMENT check above (2026-07-25) — this
    // worker's module chain has a static top-level `import { chromium } from
    // "playwright"` (export-worker.ts), which throws at import time if the
    // runtime image is missing Playwright's Chromium build (confirmed live:
    // a Docker image built without it crashed the entire server on boot,
    // taking down every other feature — auth, dashboard, every other
    // queue — over one broken export path). PAYMENT failing open was a real
    // exploit; video export failing open just means renders don't process
    // while everything else keeps serving, so a misconfigured/incomplete
    // deploy degrades instead of going fully dark.
    try {
      const { startExportQueueWorker } = await import("@/lib/video-editor/export-queue-worker");
      startExportQueueWorker();
    } catch (err) {
      console.error(
        "[startup] Export queue worker failed to start — video exports/renders will not process until this is fixed, but the rest of the app will continue serving normally:",
        err
      );
    }

    // Phase 12 Module 2 — a third, independently-tuned poll loop for
    // AI Auto-Editor jobs (transcription + scene-removal planning), same
    // "own concurrency budget" reasoning as the export queue above — see
    // ai-edit-queue-worker.ts's own doc comment.
    const { startAiEditQueueWorker } = await import("@/lib/video-editor/ai-edit-queue-worker");
    startAiEditQueueWorker();

    // Upload normalization (2026-07-19) — a fourth, independently-tuned
    // poll loop for video-upload transcoding (H.264/AAC/fps-bitrate
    // baseline), same "FFmpeg-heavy local compute, own concurrency
    // budget" reasoning as the export queue above — see
    // asset-normalize-queue-worker.ts's own doc comment.
    const { startAssetNormalizeQueueWorker } = await import("@/lib/video-editor/asset-normalize-queue-worker");
    startAssetNormalizeQueueWorker();

    // Film scene reaper (2026-07-25) — a fifth, independently-tuned poll
    // loop, same "recover a status a killed/restarted process orphaned"
    // reasoning as the export queue's reapStaleRenderingExports() above,
    // for FILM's per-scene generation specifically (a synchronous HTTP
    // call, not a queued job — see scene-reaper.ts's own doc comment for
    // why it still needs this).
    const { startFilmSceneReaper } = await import("@/lib/film/scene-reaper");
    startFilmSceneReaper();

    // Launch-readiness startup warning (2026-07-23) — getInstallationChecklist()
    // was already correctly computed but only ever visible to an admin who
    // opened Command Center/the admin layout's own banner; a real config
    // regression (a provider row disabled/deleted after launch) could go
    // unnoticed indefinitely otherwise. This doesn't block the server from
    // starting — the actual per-request enforcement is what matters and
    // already exists (getPaymentProvider()/getStorageProvider() throw in
    // production regardless of this check) — it just makes a misconfigured
    // PRODUCTION boot loud and undeniable in deploy/server logs, the
    // earliest possible moment to catch it, rather than only failing
    // silently on Mock, or loudly but no place a human is watching.
    if (process.env.NODE_ENV === "production") {
      const { getInstallationChecklist } = await import("@/lib/admin/installation-status");
      getInstallationChecklist()
        .then((checklist) => {
          if (checklist.readyForProduction) return;
          const actionNeeded = checklist.items.filter((i) => i.status === "ACTION_NEEDED");
          const border = "=".repeat(78);
          console.error(
            `\n${border}\n⚠️  LAUNCH-READINESS WARNING — this production server is NOT fully configured:\n${actionNeeded
              .map((i) => `   - ${i.label}: ${i.detail}`)
              .join("\n")}\n   Fix these in Admin → AI Providers / Command Center before real users\n   rely on this deployment. See PROJECT_STATUS.md's 2026-07-23 mock audit.\n${border}\n`
          );
        })
        .catch((err) => {
          console.error("[startup] Failed to run the launch-readiness checklist:", err);
        });
    }
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Milestone 12 — Next.js 15's official Sentry hook for uncaught
// route/render errors. Safe to export unconditionally: Sentry.captureRequestError
// is a genuine no-op when Sentry.init() was never called (SENTRY_DSN unset).
export const onRequestError = Sentry.captureRequestError;
