import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/credits/engine";
import { writeAuditLog } from "@/lib/admin/audit-log";

// Milestone 12 — Coupon Codes. Two redemption shapes:
//  - CREDITS: redeemed instantly via the existing grantCredits() (type
//    PROMOTIONAL) — a straightforward "apply this code, get credits now."
//  - PERCENT/FIXED: applied at checkout to discount a credit-package
//    purchase's amountPaise. Redemption is recorded the moment the
//    discounted PaymentIntent is created, not gated on payment actually
//    completing — a deliberate, simple choice (some real coupon systems
//    accept a little abandoned-cart leakage in exchange for not needing a
//    second schema column to carry the coupon through to settlement).

export class CouponError extends Error {
  constructor(public code: "INVALID" | "EXPIRED" | "EXHAUSTED" | "ALREADY_REDEEMED" | "WRONG_TYPE", message: string) {
    super(message);
  }
}

async function findRedeemableCoupon(code: string, userId: string) {
  const coupon = await prisma.couponCode.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon || !coupon.isActive) throw new CouponError("INVALID", "This coupon code is not valid.");
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new CouponError("EXPIRED", "This coupon has expired.");
  if (coupon.maxRedemptions != null && coupon.redeemedCount >= coupon.maxRedemptions) {
    throw new CouponError("EXHAUSTED", "This coupon has reached its redemption limit.");
  }
  const alreadyRedeemed = await prisma.couponRedemption.findUnique({
    where: { userId_couponId: { userId, couponId: coupon.id } },
  });
  if (alreadyRedeemed) throw new CouponError("ALREADY_REDEEMED", "You've already used this coupon.");
  return coupon;
}

export async function redeemCreditsCoupon(userId: string, code: string): Promise<{ creditsGranted: number }> {
  const coupon = await findRedeemableCoupon(code, userId);
  if (coupon.discountType !== "CREDITS") {
    throw new CouponError("WRONG_TYPE", "This coupon applies at checkout, not as a direct credit grant.");
  }

  await prisma.$transaction(async (tx) => {
    await grantCredits(
      {
        userId,
        lotType: "PROMOTIONAL",
        transactionType: "PROMOTIONAL",
        amount: coupon.value,
        sourceRef: coupon.id,
        description: `Coupon ${coupon.code}`,
      },
      tx
    );
    await tx.couponRedemption.create({ data: { userId, couponId: coupon.id, context: "credits" } });
    await tx.couponCode.update({ where: { id: coupon.id }, data: { redeemedCount: { increment: 1 } } });
  });

  await writeAuditLog({ userId, resource: "coupon", action: "redeemed_credits", detail: { code: coupon.code } });
  return { creditsGranted: coupon.value };
}

export interface ApplyCouponDiscountResult {
  finalAmountPaise: number;
  discountPaise: number;
  couponId: string;
}

export async function applyCouponDiscount(
  userId: string,
  code: string,
  amountPaise: number,
  context: string
): Promise<ApplyCouponDiscountResult> {
  const coupon = await findRedeemableCoupon(code, userId);
  if (coupon.discountType === "CREDITS") {
    throw new CouponError("WRONG_TYPE", "This coupon grants credits directly — redeem it from the Credits page.");
  }

  const discountPaise =
    coupon.discountType === "PERCENT"
      ? Math.round(amountPaise * (coupon.value / 100))
      : Math.round(coupon.value * 100); // FIXED value is stored in rupees
  const finalAmountPaise = Math.max(0, amountPaise - discountPaise);

  await prisma.$transaction(async (tx) => {
    await tx.couponRedemption.create({ data: { userId, couponId: coupon.id, context } });
    await tx.couponCode.update({ where: { id: coupon.id }, data: { redeemedCount: { increment: 1 } } });
  });

  await writeAuditLog({ userId, resource: "coupon", action: "redeemed_discount", detail: { code: coupon.code, discountPaise } });
  return { finalAmountPaise, discountPaise, couponId: coupon.id };
}

export async function listCoupons() {
  return prisma.couponCode.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createCoupon(input: {
  code: string;
  discountType: "PERCENT" | "FIXED" | "CREDITS";
  value: number;
  maxRedemptions?: number | null;
  expiresAt?: Date | null;
}) {
  return prisma.couponCode.create({
    data: {
      code: input.code.trim().toUpperCase(),
      discountType: input.discountType,
      value: input.value,
      maxRedemptions: input.maxRedemptions ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  });
}

export async function setCouponActive(id: string, isActive: boolean) {
  return prisma.couponCode.update({ where: { id }, data: { isActive } });
}
