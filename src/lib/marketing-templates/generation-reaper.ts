import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/observability/logger";

// Production Hardening (2026-08-03) — mirrors export-queue-worker.ts's
// reapStaleRenderingExports() / asset-normalize-worker.ts's
// reapStaleNormalizingAssets() exactly: generateFromMarketingTemplate() is a
// synchronous HTTP call (like FILM's per-scene generation, see
// lib/film/scene-reaper.ts), not a queued job — a killed/restarted process
// (a real deploy) mid-generation leaves the row at DRAFT forever, with
// nothing else in its own try/catch able to catch that (the catch only
// covers an exception WITHIN a still-running process).
//
// 20 minutes — same threshold and reasoning as scene-reaper.ts's
// STALE_RENDERING_THRESHOLD_MS: this pipeline calls the exact same
// generateImage()/renderVideo() primitives (real vendor timeout x retry
// budget), so the same worst-case real duration applies. No equivalent of
// scene-reaper's GenerationLog recent-activity cross-check exists here
// (GenerationLog isn't keyed by MarketingTemplateGeneration id) — this
// mirrors the simpler export/normalize-worker shape instead, which doesn't
// need one.
const STALE_DRAFT_THRESHOLD_MS = 20 * 60 * 1000;

export async function reapStaleDraftGenerations(): Promise<void> {
  const staleBefore = new Date(Date.now() - STALE_DRAFT_THRESHOLD_MS);
  const stale = await prisma.marketingTemplateGeneration.updateMany({
    where: { status: "DRAFT", createdAt: { lt: staleBefore } },
    data: {
      status: "FAILED",
      errorMessage: "Generation was interrupted before it could finish (likely a server restart during a real, multi-minute render) — not a failure of the render itself. Please retry.",
    },
  });
  if (stale.count > 0) {
    logger.error(
      { count: stale.count, staleThresholdMs: STALE_DRAFT_THRESHOLD_MS },
      "[marketing template generation reaper] reaped stale DRAFT generation(s) — likely orphaned by a killed/restarted process"
    );
  }
}

const POLL_INTERVAL_MS = 60_000;

const globalForGenerationReaper = globalThis as unknown as {
  __elevatexMarketingTemplateGenerationReaperStarted?: boolean;
};

async function pollOnce() {
  try {
    await reapStaleDraftGenerations();
  } catch (err) {
    logger.error({ err }, "[marketing template generation reaper] poll failed");
  }
}

export function startMarketingTemplateGenerationReaper() {
  if (globalForGenerationReaper.__elevatexMarketingTemplateGenerationReaperStarted) return;
  globalForGenerationReaper.__elevatexMarketingTemplateGenerationReaperStarted = true;

  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, "[marketing template generation reaper] started");
  setInterval(pollOnce, POLL_INTERVAL_MS);
}
