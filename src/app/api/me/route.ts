import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getUserTier } from "@/lib/credits/video-actions";

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { profile: true, creditAccount: true },
  });

  if (!user) {
    return apiError("ERR_NOT_FOUND", "Account not found.", 404);
  }

  // tier (2026-07-16) — the current subscription's PricingTierLevel, or
  // null with no active subscription. First real client-side consumer:
  // the Cloud Video Editor's export panel, to gate the watermark toggle
  // (see lib/video-editor/exports.ts's canRemoveWatermark, the actual
  // server-side enforcement this UI check merely mirrors).
  const tier = await getUserTier(user.id);

  return apiSuccess({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    profile: user.profile,
    creditBalance: user.creditAccount?.balance ?? 0,
    tier,
  });
}
