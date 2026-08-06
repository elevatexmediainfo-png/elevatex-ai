import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/admin/audit-log";

// Milestone 12 — rule-based (not ML) abuse signals, read-only on
// /admin/abuse. Both signals reuse data already being written for other
// reasons (RateLimitHit by lib/security/rate-limit.ts, CreditTransaction by
// lib/credits/engine.ts) — no new tracking table, no new write path.

const RATE_LIMIT_HIT_THRESHOLD = 50; // hits across all actions in the window
const RATE_LIMIT_WINDOW_HOURS = 24;
const FAST_BURN_CREDIT_THRESHOLD = 100; // AI_GENERATION credits spent in the window
const FAST_BURN_WINDOW_HOURS = 1;

export interface AbuseFlag {
  userId: string;
  label: string;
  reason: "EXCESSIVE_RATE_LIMIT_HITS" | "FAST_CREDIT_BURN";
  detail: string;
}

// RateLimitHit's key is `ratelimit:<action>:<identifier>` — only the
// user-keyed actions (video_create/asset_upload/ai_assistant/export_create)
// have a userId as the identifier. Any future non-user-keyed action (the
// old otp_send_phone/otp_send_ip entries, since removed, were keyed by
// phone/IP instead) would be excluded here by construction — their key
// wouldn't match any real user id as the third segment.
async function getExcessiveRateLimitUsers(): Promise<Map<string, number>> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000);
  const hits = await prisma.rateLimitHit.findMany({
    where: { createdAt: { gte: since } },
    select: { key: true },
  });

  const countByUserId = new Map<string, number>();
  for (const hit of hits) {
    const userId = hit.key.split(":")[2];
    if (!userId) continue;
    countByUserId.set(userId, (countByUserId.get(userId) ?? 0) + 1);
  }
  return countByUserId;
}

async function getFastBurnUsers(): Promise<Map<string, number>> {
  const since = new Date(Date.now() - FAST_BURN_WINDOW_HOURS * 60 * 60 * 1000);
  const groups = await prisma.creditTransaction.groupBy({
    by: ["userId"],
    where: { type: "AI_GENERATION", amount: { lt: 0 }, createdAt: { gte: since } },
    _sum: { amount: true },
  });

  const burnByUserId = new Map<string, number>();
  for (const g of groups) {
    burnByUserId.set(g.userId, Math.abs(g._sum.amount ?? 0));
  }
  return burnByUserId;
}

export async function getAbuseReport(): Promise<AbuseFlag[]> {
  const [rateLimitCounts, burnAmounts] = await Promise.all([getExcessiveRateLimitUsers(), getFastBurnUsers()]);

  const flaggedUserIds = new Set<string>();
  for (const [userId, count] of rateLimitCounts) {
    if (count >= RATE_LIMIT_HIT_THRESHOLD) flaggedUserIds.add(userId);
  }
  for (const [userId, amount] of burnAmounts) {
    if (amount >= FAST_BURN_CREDIT_THRESHOLD) flaggedUserIds.add(userId);
  }

  if (flaggedUserIds.size === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(flaggedUserIds) } },
    select: { id: true, name: true, email: true, phone: true },
  });
  const labelByUserId = new Map(users.map((u) => [u.id, u.name ?? u.email ?? u.phone ?? u.id]));

  const flags: AbuseFlag[] = [];
  for (const [userId, count] of rateLimitCounts) {
    if (count >= RATE_LIMIT_HIT_THRESHOLD) {
      flags.push({
        userId,
        label: labelByUserId.get(userId) ?? userId,
        reason: "EXCESSIVE_RATE_LIMIT_HITS",
        detail: `${count} rate-limited actions in the last ${RATE_LIMIT_WINDOW_HOURS}h`,
      });
    }
  }
  for (const [userId, amount] of burnAmounts) {
    if (amount >= FAST_BURN_CREDIT_THRESHOLD) {
      flags.push({
        userId,
        label: labelByUserId.get(userId) ?? userId,
        reason: "FAST_CREDIT_BURN",
        detail: `${amount} AI generation credits spent in the last ${FAST_BURN_WINDOW_HOURS}h`,
      });
    }
  }
  return flags;
}

export class UserNotFoundError extends Error {}

// updateMany + count check, not update() — a stale/already-deleted target
// id (or, as Phase H's live testing caught, simply a wrong id passed in)
// must surface as a clean 404 through the route, not an unhandled Prisma
// P2025 crashing the request with an empty 500 body.
export async function suspendUser(userId: string, performedBy: string) {
  const result = await prisma.user.updateMany({ where: { id: userId }, data: { accountStatus: "SUSPENDED" } });
  if (result.count === 0) throw new UserNotFoundError(`User ${userId} not found.`);
  await writeAuditLog({ userId: performedBy, resource: "user", action: "suspend", detail: { targetUserId: userId } });
}

export async function unsuspendUser(userId: string, performedBy: string) {
  const result = await prisma.user.updateMany({ where: { id: userId }, data: { accountStatus: "ACTIVE" } });
  if (result.count === 0) throw new UserNotFoundError(`User ${userId} not found.`);
  await writeAuditLog({ userId: performedBy, resource: "user", action: "unsuspend", detail: { targetUserId: userId } });
}
