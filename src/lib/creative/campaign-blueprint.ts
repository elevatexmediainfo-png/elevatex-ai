import { assembleBlueprint } from "@/lib/ai-os/blueprint";
import type { UniversalCampaignBlueprint } from "@/lib/ai-os/blueprint";
import { buildCreativeStrategy } from "@/lib/ai-os/creative-brain";
import { buildCampaignPlan } from "@/lib/ai-os/creative-director";
import { buildVisualLayoutPlan } from "@/lib/ai-os/visual-layout";
import { buildTypographyPlan } from "@/lib/ai-os/typography";
import { buildCreativeContext } from "@/lib/ai-os/creative-context";
import { analyzeUserRequest } from "@/lib/ai-os/user-understanding";
import { resolveAssetIntelligence } from "@/lib/ai-os/asset-understanding";
import type { CreativeRequest } from "@/lib/ai-os/types";

// Canvas-compositor Step 3 — re-derives the SAME UniversalCampaignBlueprint
// enhance-prompt/route.ts already builds on every real Marketing Creative
// request (real commercialCopy/renderPlan/commercialTypography, confirmed
// non-stub by direct inspection — see prior investigation), but server-side
// and from the user's own idea rather than round-tripping the client's copy.
// Text/copy generation itself is still pure/deterministic/no-LLM (the exact
// same 6-function chain enhance-prompt already runs) — the one real I/O now
// in this function is resolveAssetIntelligence()'s BrandKit lookup below,
// a single cheap indexed read, not an expensive recomputation.
//
// `rawIdea` MUST already be sanitized (lib/ai-os/request-manager's
// sanitizeIdea()) before calling this — CreativeRequest.rawIdea's own
// contract requires it, and this function does not sanitize again.
export async function deriveMarketingBlueprint(
  userId: string,
  sanitizedRawIdea: string,
  presetKey: string
): Promise<UniversalCampaignBlueprint> {
  const request: CreativeRequest = {
    userId,
    rawIdea: sanitizedRawIdea,
    kind: "MARKETING_CREATIVE",
    presetKey,
    requestedAt: new Date(),
  };
  const uu = analyzeUserRequest(request);
  // Brand-color fix — this was previously a hardcoded {}, so
  // blueprint.brand.context.primaryColor was always undefined and every
  // poster fell back to the compositor's default accent color regardless
  // of what a business actually set in BrandKit. resolveAssetIntelligence()
  // already exists and already does this correctly (used elsewhere in the
  // AI OS); this was simply never wired in for the poster path.
  const assetIntelligence = await resolveAssetIntelligence(request, userId);
  const ctx = buildCreativeContext(request, uu, assetIntelligence, { userId });
  const strategy = buildCreativeStrategy(ctx);
  const plan = buildCampaignPlan(strategy);
  const layout = buildVisualLayoutPlan(strategy, plan);
  const typography = buildTypographyPlan(strategy, plan, layout);
  return assembleBlueprint({ context: ctx, strategy, campaignPlan: plan, layoutPlan: layout, typographyPlan: typography });
}
