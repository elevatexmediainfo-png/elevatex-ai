import { generateImage } from "@/lib/generation/image";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";
import { toBuffer } from "@/lib/image/fetch-bytes";
import { getStorageProvider } from "@/lib/providers/storage";
import { composeFromBlueprint } from "@/lib/ai-os/canvas-compositor";
import { sanitizeIdea } from "@/lib/ai-os/request-manager";
import { buildCleanBackgroundPrompt } from "@/lib/creative/clean-background-prompt";
import { deriveMarketingBlueprint } from "@/lib/creative/campaign-blueprint";
import { INDUSTRY_POSTER_META } from "@/lib/creative/poster-prompt";
import { checkBackgroundZones, MAX_BACKGROUND_RETRIES } from "@/lib/creative/background-zone-check";
import { buildRenderPlanFromBlueprint } from "@/lib/ai-os/commercial-renderer/render-plan";
import type { CommercialRenderPlan } from "@/lib/ai-os/commercial-renderer/types";
import { getIndustryVisualStyle } from "@/lib/admin/reference-library";
import { buildContactBarText } from "@/lib/creative/contact-bar";
import type { BusinessVertical } from "@/generated/prisma/enums";

export interface ComposeMarketingPosterInput {
  userId: string;
  /** The user's own one-line idea — NOT the essay-style enhanced prompt. */
  rawIdea: string;
  presetKey: string;
  industry: BusinessVertical | null;
  logoStorageKey: string | null;
  // Problem 4 fix — real contact details, sourced from BrandKit by the
  // caller (engine.ts already fetches it for the buildPosterPrompt
  // fallback path; this reuses the same fetch, no new query). Never
  // AI-invented — these are the only channel contact info reaches the
  // composited poster through.
  contactPhone: string | null;
  contactWhatsapp: string | null;
  addressLine: string | null;
  websiteOrSocial: string | null;
}

// True 3:4 portrait (ratio 0.7501) at print resolution — overrides the
// blueprint's default A4 canvas (2480x3508, ratio 0.707) for this poster
// path specifically. Width matches A4's so font scale (canvas.width/1080,
// in svg-text-layer.ts) is unchanged; only the height (and everything
// computed from it — safe zones, element Y positions, matte height) shrinks
// to the correct 3:4 proportion. Chosen for print/display/WhatsApp portrait
// framing, not as a fix for the headline-clipping report — that was
// investigated separately and could not be reproduced on this canvas
// (layoutScore 100, headline comfortably clear of the top edge in testing).
const POSTER_CANVAS_WIDTH = 2480;
const POSTER_CANVAS_HEIGHT = 3307;

// Phase 2a split layout — the reference posters (Arora, the blue dental
// templates) all separate text (on a solid/gradient color zone) from photo
// (its own zone), never overlaid together — the opposite of the original
// full-bleed-photo-with-shadowed-text design. 52% floor derived from the
// actual head-position math: the photo prompt's own top/head-size rules
// mean a worst-case head can extend to ~48% of canvas height after the
// crop's width-matched scale-up, so 52% keeps a real buffer above that
// floor rather than sitting exactly on it.
//
// [Head-cropping fix attempt, v2, 2026-07-24] First tried raising this to
// 56% for more buffer, verified with a real composed sample — and found a
// DIFFERENT real regression instead: applySplitLayoutShift's bottom-
// anchored elements (socialProof/disclaimer/footer/contact bar) don't move
// when this fraction changes (by design — see that function's own doc
// comment), but the shifted content block above them (headline through
// benefits) starts lower with a smaller fraction change, so it now
// collides with socialProof — confirmed visually, not assumed (the
// generated sample showed the "Google Rating" line overlapping the
// benefits row). Reverted back to 52%, which is already known to fit
// (the color zone "only just fits" at this size per the note above — real
// headroom to push it further doesn't exist without also reworking
// applySplitLayoutShift's spacing math, out of scope for this fix). The
// actual mitigation that shipped is clean-background-prompt.ts's v7 head-
// size/position tightening — zero layout cost, independently reduces the
// worst-case head extent without touching this boundary at all.
const SPLIT_LAYOUT_PHOTO_ZONE_FRACTION = 0.52;
const SPLIT_LAYOUT_SEAM_GAP_FRACTION = 0.02;
const SPLIT_LAYOUT_GAP_TIGHTEN = 0.6; // 40% tighter than the natural full-bleed spacing

// Repositions the top-down text flow (headline/subheadline/offer/benefits)
// into the color zone below the (now shorter) photo zone. Everything
// bottom-anchored (cta/secondaryCta/socialProof/disclaimer/footer/contact
// bar) is untouched — those already live in what's now simply a larger
// version of the same color zone, no repositioning needed. Pure geometry
// override on a plain object (same technique already used for the 3:4
// canvas and footer-typography overrides) — commercial-renderer itself is
// never touched.
function applySplitLayoutShift(renderPlan: CommercialRenderPlan): CommercialRenderPlan {
  const { canvas } = renderPlan;
  const contentTop = Math.round(canvas.height * (SPLIT_LAYOUT_PHOTO_ZONE_FRACTION + SPLIT_LAYOUT_SEAM_GAP_FRACTION));

  const gapAfterHeadline = renderPlan.subheadline
    ? renderPlan.subheadline.y - (renderPlan.headline.y + renderPlan.headline.height)
    : renderPlan.offer
      ? renderPlan.offer.y - (renderPlan.headline.y + renderPlan.headline.height)
      : renderPlan.benefits.y - (renderPlan.headline.y + renderPlan.headline.height);
  const tightGapAfterHeadline = Math.round(Math.max(0, gapAfterHeadline) * SPLIT_LAYOUT_GAP_TIGHTEN);

  const newHeadline = { ...renderPlan.headline, y: contentTop };

  const newSubheadline = renderPlan.subheadline
    ? { ...renderPlan.subheadline, y: newHeadline.y + newHeadline.height + tightGapAfterHeadline }
    : null;
  const afterHeadlineBlockY = newSubheadline
    ? newSubheadline.y + newSubheadline.height
    : newHeadline.y + newHeadline.height;

  const gapAfterSubheadline = renderPlan.subheadline
    ? (renderPlan.offer ? renderPlan.offer.y : renderPlan.benefits.y) - (renderPlan.subheadline.y + renderPlan.subheadline.height)
    : gapAfterHeadline;
  const tightGapAfterSubheadline = Math.round(Math.max(0, gapAfterSubheadline) * SPLIT_LAYOUT_GAP_TIGHTEN);

  const newOffer = renderPlan.offer
    ? { ...renderPlan.offer, y: afterHeadlineBlockY + tightGapAfterSubheadline }
    : null;
  const afterOfferBlockY = newOffer
    ? newOffer.y + newOffer.height
    : afterHeadlineBlockY;

  const newBenefits = { ...renderPlan.benefits, y: afterOfferBlockY + tightGapAfterSubheadline };

  return {
    ...renderPlan,
    headline: newHeadline,
    subheadline: newSubheadline,
    offer: newOffer,
    benefits: newBenefits,
  };
}

// Canvas-compositor Step 3 — the actual composited-poster path for
// MARKETING_CREATIVE: real blueprint copy/layout composited onto a clean
// AI background, instead of asking the model to draw the text itself.
//
// Throws on any failure (blueprint re-derivation, clean-background
// generation, logo fetch, or compositing) — by design. The caller
// (generateCreativeImage) catches this and falls back to buildPosterPrompt,
// per the product decision that the compositor is an upgrade, never a
// single point of failure a user can be blocked by.
//
// composeFromBlueprint() already resizes the background to the render
// plan's canvas internally (with reserveBottomBand set, so it also crops
// the photo top-anchored and mattes the reserved footer band), so there's
// no separate manual resize step here.
export async function composeMarketingPoster(input: ComposeMarketingPosterInput): Promise<Buffer> {
  const safeIdea = sanitizeIdea(input.rawIdea);

  const blueprint = await deriveMarketingBlueprint(input.userId, safeIdea, input.presetKey);

  // Problem 4 fix — real contact details replace the footer's generic
  // tagline when BrandKit has any; buildContactBarText() returns null
  // (falls back to the existing tagline) when all four fields are empty,
  // so this is never worse than today. Computed before the renderPlan
  // below so the footer's bumped typography (readability fix) and the
  // renderPlan's footer-height calculation stay in sync — building the
  // renderPlan from stale typography would size the box for the smaller
  // pre-bump font.
  const contactBarText = buildContactBarText({
    contactPhone: input.contactPhone,
    contactWhatsapp: input.contactWhatsapp,
    addressLine: input.addressLine,
    websiteOrSocial: input.websiteOrSocial,
  });

  // CTA decision (locked in) — INDUSTRY_POSTER_META's hand-curated,
  // conversion-oriented per-industry CTA wins over copy-intelligence's own
  // generic CTA (e.g. "Book a Free Consultation" beats "Learn More").
  // blueprint is shallow-frozen (its own contract: "downstream modules must
  // not mutate"), so this builds a new object rather than assigning into it.
  const industryMeta = input.industry ? INDUSTRY_POSTER_META[input.industry] : null;
  const blueprintWithCta =
    industryMeta && blueprint.commercialCopy
      ? { ...blueprint, commercialCopy: { ...blueprint.commercialCopy, cta: industryMeta.cta } }
      : blueprint;

  // Contact-bar readability fix — the footer's default typography (xs,
  // light, 60% opacity, medium contrast) was tuned for a decorative
  // tagline nobody needed to actually read. A phone number someone needs
  // to dial shouldn't be that faint. Bumped one step up on every axis
  // that affects legibility, but deliberately short of headline/CTA
  // weight (bold) or size (xl+) — readable at normal viewing size,
  // still clearly secondary to the main message. Only applied when real
  // contact info is being shown; the generic-tagline fallback keeps its
  // original subtle styling unchanged.
  const blueprintWithFooterTypography =
    contactBarText && blueprintWithCta.commercialTypography
      ? {
          ...blueprintWithCta,
          commercialTypography: {
            ...blueprintWithCta.commercialTypography,
            footer: {
              ...blueprintWithCta.commercialTypography.footer,
              size: "sm" as const,
              weight: "medium" as const,
              opacity: 92,
              contrast: "high" as const,
            },
          },
        }
      : blueprintWithCta;

  // blueprint.renderPlan is already populated (at A4) by the blueprint
  // builder — composeFromBlueprint() would use that as-is via its own
  // `blueprint.renderPlan ?? buildRenderPlanFromBlueprint(blueprint)` fallback,
  // which never triggers since renderPlan is never null. Recomputing it
  // explicitly against the 3:4 canvas and overriding it below is what
  // actually changes the output shape.
  const posterRenderPlan = buildRenderPlanFromBlueprint(blueprintWithFooterTypography, POSTER_CANVAS_WIDTH, POSTER_CANVAS_HEIGHT);
  const splitLayoutRenderPlan = applySplitLayoutShift(posterRenderPlan);
  const blueprintForCompositing = { ...blueprintWithFooterTypography, renderPlan: splitLayoutRenderPlan };

  // Problem 3 fix — Admin Reference Library connection. Style-only (layout
  // clause dropped; the renderPlan above controls layout, not the photo).
  // Null for any industry with no active curated samples or guidance note,
  // in which case buildCleanBackgroundPrompt() omits the block entirely.
  const visualStyle = input.industry ? await getIndustryVisualStyle(input.industry) : null;

  const cleanPrompt = buildCleanBackgroundPrompt({
    rawIdea: safeIdea,
    industryLabel: industryMeta?.label ?? null,
    visualStyle,
  });

  const backgroundBuffer = await generateVerifiedCleanBackground(cleanPrompt, input.userId);

  const assetBuffers = input.logoStorageKey
    ? { logo: await (await getStorageProvider()).download(input.logoStorageKey) }
    : undefined;

  const composed = await composeFromBlueprint(blueprintForCompositing, backgroundBuffer, assetBuffers, {
    outputFormat: "jpeg",
    contactBarText,
    splitLayout: { photoZoneFraction: SPLIT_LAYOUT_PHOTO_ZONE_FRACTION },
  });
  return composed.imageBuffer;
}

// Reliability fix — the strengthened composition wording improves the odds
// of a clean top zone but isn't deterministic (real measured rate: 3/4).
// This is the actual backstop: generate, verify with checkBackgroundZones(),
// retry up to MAX_BACKGROUND_RETRIES times, then give up and let the
// caller's existing fallback-to-buildPosterPrompt handle it. Every attempt's
// result is logged (pass/fail + what the vision-LLM said was intruding)
// specifically so real usage data can answer "how often does attempt 1
// pass" — that's what determines whether 2 retries is even the right
// number, not a guess.
//
// Bottom zone is no longer checked here — canvas-engine.ts's
// reserveBottomBand crop+matte guarantees it structurally regardless of
// what the generated photo contains below the matte line, so there's
// nothing left for a generation-time retry to fix on that side.
//
// Head-safety gate — still NOT a per-generation detection/rejection gate
// (that remains future work, likely needing a real deterministic
// face-detection model — see background-zone-check.ts's v4 history for why
// two vision-LLM attempts at exactly that were both reverted). What IS
// fixed as of 2026-07-24: the generation prompt's head-size/position rule
// was tightened (clean-background-prompt.ts's v7 — smaller head, higher
// position, pushing the worst-case chin position further from the
// split-layout boundary). A companion attempt to ALSO widen the boundary
// itself (SPLIT_LAYOUT_PHOTO_ZONE_FRACTION) was tried, real-verified, and
// reverted — it fixed head clipping but broke the text layout's bottom
// section instead (see that constant's own updated comment for the real
// composed-sample evidence). Net effect: a real, but partial, reduction
// in how often a head reaches the boundary — not a guarantee, and not
// tested at the same rigor as a statistically significant sample (one
// real composed sample was inspected for this fix, not dozens). This
// retry loop still only verifies the TOP zone (the one check proven
// reliable); a head that clips the split-layout boundary would still
// pass this loop undetected.
async function generateVerifiedCleanBackground(prompt: string, userId: string): Promise<Buffer> {
  let lastFailureReason = "unknown";

  for (let attempt = 1; attempt <= MAX_BACKGROUND_RETRIES + 1; attempt++) {
    const result = await generateImage({ prompt, aspectRatio: "RATIO_9_16" }, "creative_image", { userId });

    // Fixed (2026-07-24) — a real IMAGE provider outage would previously
    // let MockImageProvider's canned sample run the full zone-check retry
    // loop like a real candidate background — worse, if the mock sample
    // happened to pass the zone check, composeMarketingPoster() would
    // return successfully with mock content composited into a real-looking
    // poster, silently bypassing the caller's own fallback-to-
    // buildPosterPrompt path (and that path's own now-fixed mock guard)
    // entirely, since a successful composite is never treated as a
    // failure. Thrown immediately rather than retried — retrying against a
    // still-down provider wastes the remaining attempts on more mock
    // samples. The caller already treats ANY thrown error here as "the
    // compositor upgrade isn't available this time" and falls back
    // cleanly, so this doesn't need its own new handling.
    if (result.providerId === MOCK_PROVIDER_ID) {
      throw new Error("Clean-background generation used the placeholder provider, not a real one.");
    }

    let check;
    try {
      check = await checkBackgroundZones(result.imageUrl, userId);
    } catch (err) {
      // A flaky check call (network/parsing) is not evidence the image is
      // bad — treat it the same as a failed check and retry, rather than
      // trusting an unverified background or throwing early.
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[background-zone-check] attempt ${attempt}/${MAX_BACKGROUND_RETRIES + 1}: check call failed (${message}), treating as fail`);
      lastFailureReason = `zone check errored: ${message}`;
      continue;
    }

    const topStatus = check.topZoneClean ? "clean" : `FAIL (${check.topZoneIssue ?? "unspecified"})`;
    console.log(`[background-zone-check] attempt ${attempt}/${MAX_BACKGROUND_RETRIES + 1}: top=${topStatus}`);

    if (check.topZoneClean) {
      const { buffer } = await toBuffer(result.imageUrl);
      return buffer;
    }

    lastFailureReason = `top=${check.topZoneIssue ?? "ok"}`;
  }

  throw new Error(`generateVerifiedCleanBackground: no clean background after ${MAX_BACKGROUND_RETRIES + 1} attempts (${lastFailureReason})`);
}
