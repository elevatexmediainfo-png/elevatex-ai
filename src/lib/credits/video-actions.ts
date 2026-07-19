import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { getCreditBalance, InsufficientCreditsError } from "./engine";

// AI Video Phase 1 — the credit+tier precheck shared by every gated video
// action (Animated Poster today; Veo/Kling/Seedance/UGC in later phases —
// see VIDEO_ACTION_CREDIT_COSTS's own doc comment for why this is one
// admin-editable record instead of a config key per action). Mirrors
// renderTalkingHeadScene()'s precheck-then-charge-after-success pattern:
// this function only ever CHECKS, it never calls consumeCredits() itself —
// the caller charges after its own generation actually succeeds.

export type PricingTierLevel = "BASIC" | "PRO" | "PREMIUM";

// Ranked by declaration order, not implicit enum/DB ordering — the single
// place "PRO is above BASIC" is asserted.
export const PRICING_TIER_RANK: Record<PricingTierLevel, number> = {
  BASIC: 1,
  PRO: 2,
  PREMIUM: 3,
};

export class InsufficientTierError extends Error {
  constructor(
    public readonly actionKey: string,
    public readonly requiredTier: PricingTierLevel,
    public readonly currentTier: PricingTierLevel | null
  ) {
    super(
      currentTier
        ? `"${actionKey}" requires the ${requiredTier} plan or higher (current plan: ${currentTier}).`
        : `"${actionKey}" requires an active ${requiredTier}-or-higher subscription.`
    );
    this.name = "InsufficientTierError";
  }
}

export class UnknownVideoActionError extends Error {
  constructor(actionKey: string) {
    super(`No credit cost configured for video action "${actionKey}".`);
    this.name = "UnknownVideoActionError";
  }
}

export interface VideoActionAccess {
  credits: number;
}

// The user's current subscription tier, or null with no active
// subscription — the one place this lookup is written, reused by
// checkVideoActionAccess below and by any other tier-gated feature (e.g.
// the Cloud Video Editor's export watermark gate, lib/video-editor/exports.ts)
// so the "ACTIVE subscription -> plan.tierLevel" join isn't duplicated
// per call site.
export async function getUserTier(userId: string): Promise<PricingTierLevel | null> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { plan: true },
  });
  return (subscription?.plan.tierLevel ?? null) as PricingTierLevel | null;
}

// Checked before any vendor/render cost is spent — same reasoning as every
// other pre-check in this codebase (renderTalkingHeadScene, generateCreativeImage):
// an optimization, not the only guard, since a real charge still validates
// atomically at consumeCredits() time.
export async function checkVideoActionAccess(userId: string, actionKey: string): Promise<VideoActionAccess> {
  const costs = await getConfig("VIDEO_ACTION_CREDIT_COSTS");
  const action = costs[actionKey];
  if (!action) throw new UnknownVideoActionError(actionKey);

  const currentTier = await getUserTier(userId);

  if (!currentTier || PRICING_TIER_RANK[currentTier] < PRICING_TIER_RANK[action.minimumTier]) {
    throw new InsufficientTierError(actionKey, action.minimumTier, currentTier);
  }

  if (action.credits > 0) {
    const balance = await getCreditBalance(userId);
    if (balance < action.credits) throw new InsufficientCreditsError(action.credits, balance);
  }

  return { credits: action.credits };
}

// Same 2.5x margin / ₹6.66-per-credit-floor convention already used for
// every fixed-price video action's own manual pricing comment (veo_lite,
// veo_standard, film_scene — see VIDEO_ACTION_CREDIT_COSTS' doc comments),
// generalized into a reusable formula for actions whose real cost varies
// per-run instead of being a known fixed amount (e.g. AI Auto-Editor, whose
// total vendor spend depends on video length/providers used). USD_TO_INR_RATE
// is the one already-admin-configurable input; the margin and floor are the
// same fixed constants the fixed-price actions above already bake in
// manually — kept here as one reusable, named calculation instead of a
// third hand-copied one.
const VIDEO_ACTION_MARGIN_MULTIPLIER = 2.5;
const VIDEO_ACTION_CREDIT_FLOOR_INR = 6.66;

export function convertUsdToCredits(costUsd: number, usdToInrRate: number): number {
  if (costUsd <= 0) return 0;
  return Math.ceil((costUsd * usdToInrRate * VIDEO_ACTION_MARGIN_MULTIPLIER) / VIDEO_ACTION_CREDIT_FLOOR_INR);
}
