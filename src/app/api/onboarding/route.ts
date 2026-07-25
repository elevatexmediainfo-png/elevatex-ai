import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { onboardingSchema } from "@/lib/validations/onboarding";
import { applyReferralCode } from "@/lib/referrals/engine";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const data = onboardingSchema.parse(body);

    const profile = await prisma.profile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        businessName: data.businessName,
        businessVertical: data.businessVertical,
        city: data.city || null,
        uiLanguage: data.uiLanguage,
        contentLanguage: data.contentLanguage,
        onboardingCompletedAt: new Date(),
      },
      update: {
        businessName: data.businessName,
        businessVertical: data.businessVertical,
        city: data.city || null,
        uiLanguage: data.uiLanguage,
        contentLanguage: data.contentLanguage,
        onboardingCompletedAt: new Date(),
      },
    });

    // Milestone 12 — best-effort, never blocks onboarding completion on an
    // invalid/already-applied code. applyReferralCode() itself enforces
    // one-time-only and rejects self-referral.
    let referral: Awaited<ReturnType<typeof applyReferralCode>> | undefined;
    if (data.referralCode) {
      referral = await applyReferralCode(session.user.id, data.referralCode).catch(() => undefined);
    }

    return apiSuccess({
      onboardingCompleted: !!profile.onboardingCompletedAt,
      referralApplied: referral?.applied ?? null,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the form and try again.", 400, {
        issues: err.issues,
      });
    }
    console.error("POST /api/onboarding failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
