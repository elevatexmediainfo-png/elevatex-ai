import { randomInt } from "crypto";

import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/credits/engine";
import { getConfig } from "@/lib/admin/config";
import { writeAuditLog } from "@/lib/admin/audit-log";

// Milestone 12 — Referral System. A code is generated lazily on first
// request, not at signup, so existing pre-M12 users backfill for free.
// Applying a code is a one-time action at onboarding; both sides are
// credited via the existing grantCredits() (type REFERRAL, an enum value
// that existed since the Credit Engine's first milestone but had no
// trigger point until now).

const CODE_LENGTH = 8;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids ambiguous codes

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  }
  return code;
}

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (user?.referralCode) return user.referralCode;

  // Collision is astronomically unlikely at this code space, but retry a
  // few times rather than trusting that — same defensive posture as every
  // other unique-code generator in this codebase.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      const updated = await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return updated.referralCode!;
    } catch {
      // unique constraint collision — retry with a new code
    }
  }
  throw new Error("Could not generate a unique referral code after 5 attempts.");
}

export type ApplyReferralCodeResult =
  | { applied: true }
  | { applied: false; reason: "INVALID_CODE" | "SELF_REFERRAL" | "ALREADY_REFERRED" };

// One-time only: a user who already has referredById set (or who is
// applying their own code) is rejected, not silently re-credited.
export async function applyReferralCode(userId: string, code: string): Promise<ApplyReferralCodeResult> {
  const trimmedCode = code.trim().toUpperCase();
  const [referrer, self] = await Promise.all([
    prisma.user.findUnique({ where: { referralCode: trimmedCode } }),
    prisma.user.findUnique({ where: { id: userId }, select: { referredById: true } }),
  ]);

  if (!referrer) return { applied: false, reason: "INVALID_CODE" };
  if (referrer.id === userId) return { applied: false, reason: "SELF_REFERRAL" };
  if (self?.referredById) return { applied: false, reason: "ALREADY_REFERRED" };

  const bonus = await getConfig("REFERRAL_BONUS_CREDITS");
  const expiryDays = await getConfig("REFERRAL_CREDIT_EXPIRY_DAYS");
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { referredById: referrer.id } });

    if (bonus.refereeCredits > 0) {
      await grantCredits(
        {
          userId,
          lotType: "REFERRAL",
          transactionType: "REFERRAL",
          amount: bonus.refereeCredits,
          expiresAt,
          sourceRef: referrer.id,
          description: "Referral signup bonus",
        },
        tx
      );
    }
    if (bonus.referrerCredits > 0) {
      await grantCredits(
        {
          userId: referrer.id,
          lotType: "REFERRAL",
          transactionType: "REFERRAL",
          amount: bonus.referrerCredits,
          expiresAt,
          sourceRef: userId,
          description: "Referral bonus — you referred a new user",
        },
        tx
      );
    }
  });

  await writeAuditLog({ userId, resource: "referral", action: "applied", detail: { referrerId: referrer.id } });

  return { applied: true };
}

export async function getReferralStats(userId: string) {
  const [referralCode, referralCount] = await Promise.all([
    getOrCreateReferralCode(userId),
    prisma.user.count({ where: { referredById: userId } }),
  ]);
  return { referralCode, referralCount };
}
