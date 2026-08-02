import * as Sentry from "@sentry/nextjs";

// Next.js server-startup hook (stable since Next 15, runs once per server
// process). Starting the queue worker here — rather than as a side effect of
// importing some route file — keeps it explicit and out of the request path.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    const { validateEnv } = await import("@/lib/env");
    validateEnv();

    // PAYMENT hard-boot-block removed (2026-07-26, explicit request — dev/
    // test VPS deployment must never refuse to boot over payment config).
    // Per-request enforcement is untouched and remains the real
    // protection: getPaymentProvider()/isPaymentCheckoutAvailable()
    // (src/lib/providers/payment/index.ts) still throw
    // PaymentProviderUnavailableError for every checkout/order/subscription
    // route when no real provider is enabled in production — this file no
    // longer duplicates that check at startup to crash the whole server
    // over it. See PROJECT_STATUS.md's 2026-07-23 PAYMENT exploit fix for
    // why that per-request check exists and must never be relaxed.

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

    // Marketing Template generation reaper (2026-08-03) — a sixth,
    // independently-tuned poll loop, same "recover a status a killed/
    // restarted process orphaned" reasoning as the film scene reaper
    // above, for generateFromMarketingTemplate() specifically (also a
    // synchronous HTTP call, not a queued job).
    const { startMarketingTemplateGenerationReaper } = await import("@/lib/marketing-templates/generation-reaper");
    startMarketingTemplateGenerationReaper();

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
