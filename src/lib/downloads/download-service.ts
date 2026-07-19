import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { DownloadMethod } from "@/generated/prisma/enums";
import { getStorageProvider } from "@/lib/providers/storage";
import { getConfig } from "@/lib/admin/config";
import { consumeCredits } from "@/lib/credits/engine";

// Milestone 4 — the ONLY place a user is entitled to the clean, full-HD
// master asset. Previews are free/unlimited and never go through here.
// Validates, in order: an existing entitlement (free re-download), a daily
// rate limit, an active subscription with remaining monthly downloads, then
// credits. One-time purchases and admin grants are recorded directly via
// recordPurchasedDownload/adminGrantDownload once payment/admin action has
// already happened — they never re-enter this validation chain.
// Callers should catch InsufficientCreditsError from @/lib/credits/engine.

export class VideoNotReadyError extends Error {}
export class DownloadLimitExceededError extends Error {}

const SIGNED_URL_TTL_SECONDS = 15 * 60;

interface RequestDownloadInput {
  userId: string;
  videoProjectId: string;
}

export interface DownloadResult {
  url: string;
  expiresAt: Date;
  method: DownloadMethod;
  alreadyOwned: boolean;
}

// Exported for reuse by the one-time-purchase route (app/api/videos/[id]/purchase),
// which needs the same "is this video actually downloadable" rule before
// it's worth opening a PaymentIntent for it.
export async function getReadyProject(userId: string, videoProjectId: string) {
  const project = await prisma.videoProject.findFirst({
    where: { id: videoProjectId, userId },
  });
  if (!project) throw new Error("Video project not found.");
  if (project.status !== "COMPLETED" || !project.masterVideoUrl) {
    throw new VideoNotReadyError("This video isn't ready to download yet.");
  }
  return project as typeof project & { masterVideoUrl: string };
}

// A subscription only counts as "usable" if its plan either has no monthly
// download cap, or the cap hasn't been hit yet this billing period.
async function findUsableSubscription(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
    include: { plan: true },
  });
  if (!subscription) return null;
  if (subscription.plan.maxDownloadsPerMonth == null) return subscription;

  const usedThisPeriod = await prisma.download.count({
    where: {
      userId,
      method: "SUBSCRIPTION",
      createdAt: { gte: subscription.currentPeriodStart },
    },
  });
  return usedThisPeriod < subscription.plan.maxDownloadsPerMonth ? subscription : null;
}

// Exported for reuse by the one-time-purchase route — no point opening a new
// PaymentIntent for a video the user is already entitled to download.
export async function findExistingDownload(userId: string, videoProjectId: string) {
  return prisma.download.findFirst({
    where: { userId, videoProjectId },
    orderBy: { createdAt: "desc" },
  });
}

export async function requestDownload({
  userId,
  videoProjectId,
}: RequestDownloadInput): Promise<DownloadResult> {
  const project = await getReadyProject(userId, videoProjectId);

  const storage = await getStorageProvider();
  const signed = await storage.getSignedDownloadUrl(project.masterVideoUrl, SIGNED_URL_TTL_SECONDS);

  // Re-downloading something already entitled never re-validates or
  // re-charges — it just mints a fresh signed URL (the old one may have
  // expired) against the original Download record's method.
  const existing = await findExistingDownload(userId, videoProjectId);
  if (existing) {
    return { url: signed.url, expiresAt: signed.expiresAt, method: existing.method, alreadyOwned: true };
  }

  // Daily cap on NEW download grants (admin-configurable). Re-downloads
  // above don't count against it — this guards the entitlement checks
  // below, not video-watching.
  const rateLimit = await getConfig("DOWNLOAD_RATE_LIMIT_PER_DAY");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await prisma.download.count({ where: { userId, createdAt: { gte: since } } });
  if (recentCount >= rateLimit) {
    throw new DownloadLimitExceededError(`You've reached today's download limit (${rateLimit}).`);
  }

  const subscription = await findUsableSubscription(userId);
  if (subscription) {
    const download = await prisma.download.create({
      data: {
        userId,
        videoProjectId,
        method: "SUBSCRIPTION",
        downloadUrl: signed.url,
        expiresAt: signed.expiresAt,
        providerRef: subscription.id,
      },
    });
    return { url: signed.url, expiresAt: signed.expiresAt, method: download.method, alreadyOwned: false };
  }

  // Credits — consumeCredits + the Download row land in one transaction so
  // a crash between the two can never charge a credit with no entitlement
  // recorded (or vice versa).
  //
  // Fixed 2026-07-19 — GENERATED (script-ad) and FILM projects no longer
  // charge this project.creditCost download toll: both now charge real,
  // admin-configured credits per scene AT GENERATION time (veo_lite /
  // film in VIDEO_ACTION_CREDIT_COSTS — see lib/render/pipeline.ts's own
  // "credit-model switch" comment), so this leftover flat 1-credit charge
  // from the old "rendering is free, only download costs" Milestone 4
  // model (VideoProject.creditCost's own doc comment) was a genuine
  // double-charge, not a second legitimate fee. TALKING_HEAD_UPLOAD is
  // deliberately excluded — its render-time charge only applies to scenes
  // that actually generate new AI content (TALKING_HEAD_CREDIT_COSTS),
  // reused/free assets cost nothing at render time, so this download toll
  // still serves as its real entitlement/paywall step, same as before.
  const chargeForDownload = project.sourceType !== "GENERATED" && project.sourceType !== "FILM";

  const download = await prisma.$transaction(async (tx) => {
    if (chargeForDownload) {
      await consumeCredits(
        {
          userId,
          amount: project.creditCost,
          type: "DOWNLOAD",
          description: `Download: ${project.title}`,
          videoProjectId: project.id,
        },
        tx
      );
    }
    return tx.download.create({
      data: {
        userId,
        videoProjectId,
        method: "CREDIT",
        creditsSpent: chargeForDownload ? project.creditCost : 0,
        downloadUrl: signed.url,
        expiresAt: signed.expiresAt,
      },
    });
  });

  return { url: signed.url, expiresAt: signed.expiresAt, method: download.method, alreadyOwned: false };
}

async function createEntitledDownload(
  input: {
    userId: string;
    videoProjectId: string;
    method: DownloadMethod;
    amountPaidPaise?: number;
    providerRef?: string;
  },
  db?: Prisma.TransactionClient
): Promise<DownloadResult> {
  const project = await getReadyProject(input.userId, input.videoProjectId);
  const storage = await getStorageProvider();
  const signed = await storage.getSignedDownloadUrl(project.masterVideoUrl, SIGNED_URL_TTL_SECONDS);

  const run = async (tx: Prisma.TransactionClient | typeof prisma) =>
    tx.download.create({
      data: {
        userId: input.userId,
        videoProjectId: input.videoProjectId,
        method: input.method,
        amountPaidPaise: input.amountPaidPaise,
        providerRef: input.providerRef,
        downloadUrl: signed.url,
        expiresAt: signed.expiresAt,
      },
    });

  const download = db ? await run(db) : await prisma.$transaction(run);
  return { url: signed.url, expiresAt: signed.expiresAt, method: download.method, alreadyOwned: false };
}

// Called by billing fulfillment (lib/billing/fulfillment.ts) once a
// ONE_TIME_DOWNLOAD PaymentIntent is confirmed PAID — payment already
// happened, so this records the entitlement directly instead of re-entering
// requestDownload's subscription/credit checks.
export async function recordPurchasedDownload(
  input: { userId: string; videoProjectId: string; amountPaidPaise: number; providerRef?: string },
  db?: Prisma.TransactionClient
): Promise<DownloadResult> {
  return createEntitledDownload({ ...input, method: "ONE_TIME_PURCHASE" }, db);
}

// Called from the admin panel to comp a download (support/goodwill) without
// touching the user's credits or subscription.
export async function adminGrantDownload(
  input: { userId: string; videoProjectId: string },
  db?: Prisma.TransactionClient
): Promise<DownloadResult> {
  return createEntitledDownload({ ...input, method: "ADMIN_GRANT" }, db);
}

export async function listDownloads(userId: string, limit = 20) {
  return prisma.download.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { videoProject: { select: { title: true } } },
  });
}
