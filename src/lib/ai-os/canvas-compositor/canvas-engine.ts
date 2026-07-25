// Phase 9.3 — Canvas Engine (main compositor).
// Composites background image + SVG text layer + asset overlays → FinalAdvertisement.
// This is the ONLY module in the AI OS that produces actual pixel data.

import sharp from "sharp";
import type { UniversalCampaignBlueprint } from "../blueprint/types";
import { buildRenderPlanFromBlueprint }    from "../commercial-renderer/render-plan";
import type { CanvasSize, CommercialRenderPlan } from "../commercial-renderer/types";
import type {
  CanvasCompositorInput,
  FinalAdvertisement,
  LayerName,
  AssetBuffers,
  OutputFormat,
} from "./types";
import { buildSvgTextLayer } from "./svg-text-layer";
import { buildAssetOverlays } from "./asset-compositor";
import { resolveCTAButtonColor } from "./color-resolver";

// ─────────────────────────────────────────────────────────────────────────────
// Core compositor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Composes a final advertisement image from explicit inputs.
 * Does not require a Blueprint — useful when components are assembled externally.
 */
export async function composeAdvertisement(
  input: CanvasCompositorInput,
): Promise<FinalAdvertisement> {
  const start = Date.now();

  const {
    backgroundImageBuffer,
    renderPlan,
    copy,
    typography,
    brandContext,
    assetBuffers,
    outputFormat = "png",
    quality = 90,
    reserveBottomBand = false,
    contactBarText,
    splitLayout,
  } = input;

  const { canvas } = renderPlan;
  const layersApplied: LayerName[] = ["background"];

  // ── Build SVG text layer ───────────────────────────────────────────────────
  const svgString = buildSvgTextLayer(renderPlan, copy, typography, {
    brandPrimaryColor: brandContext?.primaryColor,
    contactBarText,
    useBenefitChips: !!splitLayout,
  });
  const svgBuffer = Buffer.from(svgString);
  layersApplied.push("text_overlay");

  // ── Resize + composite asset buffers ──────────────────────────────────────
  const { overlays, applied } = await buildAssetOverlays(renderPlan, assetBuffers);
  layersApplied.push(...applied);

  // ── Sharp pipeline ────────────────────────────────────────────────────────
  const compositeInputs = [
    { input: svgBuffer, top: 0, left: 0 },
    ...overlays,
  ];

  // Phase 1 decoration — the same resolved color the CTA button already
  // uses (brand primaryColor, or the shared "trust blue" default when a
  // business hasn't set one) drives the matte gradient's tint too, so
  // everything decorative stays coordinated with zero extra config.
  const accentColor = resolveCTAButtonColor(brandContext?.primaryColor);

  // reserveBottomBand is opt-in (see types.ts) — the default path below is
  // untouched byte-for-byte so every other caller/layout keeps today's
  // behavior. Only the matte branch does the crop+sample work.
  const pipeline = reserveBottomBand
    ? sharp(await buildMattedBackground(backgroundImageBuffer, canvas, renderPlan, accentColor, splitLayout)).composite(compositeInputs)
    : sharp(backgroundImageBuffer).resize(canvas.width, canvas.height, { fit: "cover" }).composite(compositeInputs);

  let imageBuffer: Buffer;
  const mimeType = mimeTypeFor(outputFormat);

  if (outputFormat === "jpeg") {
    imageBuffer = await pipeline.jpeg({ quality }).toBuffer();
  } else if (outputFormat === "webp") {
    imageBuffer = await pipeline.webp({ quality }).toBuffer();
  } else {
    imageBuffer = await pipeline.png().toBuffer();
  }

  return {
    imageBuffer,
    mimeType,
    width:  canvas.width,
    height: canvas.height,
    layersApplied,
    processingTimeMs: Date.now() - start,
    renderPlanUsed:   renderPlan,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Blueprint convenience wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Composes a final advertisement from a UniversalCampaignBlueprint.
 * Requires blueprint.commercialCopy, blueprint.commercialTypography, and
 * either blueprint.renderPlan or enough data to derive one.
 */
export async function composeFromBlueprint(
  blueprint:             UniversalCampaignBlueprint,
  backgroundImageBuffer: Buffer,
  assetBuffers?:         AssetBuffers,
  options?: {
    outputFormat?:   OutputFormat;
    quality?:        number;
    contactBarText?: string | null;
    splitLayout?:    { photoZoneFraction: number };
  },
): Promise<FinalAdvertisement> {
  const { commercialCopy, commercialTypography } = blueprint;

  if (!commercialCopy) {
    throw new Error("Canvas Compositor: blueprint.commercialCopy is required");
  }
  if (!commercialTypography) {
    throw new Error("Canvas Compositor: blueprint.commercialTypography is required");
  }

  const renderPlan = blueprint.renderPlan ?? buildRenderPlanFromBlueprint(blueprint);

  // Extract brand primary color — context.primaryColor first, since it's
  // BrandKit.primaryColor passed through as a single clean hex value;
  // kit.brandColors.value is a comma-joined "primary, secondary" string
  // (analyzeBrandKit()) that fails resolveCTAButtonColor()'s single-hex
  // validation, so checking it first would silently fall back to the
  // default color even when a real BrandKit color exists. This order
  // matches the already-correct precedent in commercial-review/brand-review.ts.
  const primaryColor =
    blueprint.brand?.context?.primaryColor ??
    blueprint.brand?.kit?.brandColors?.value ??
    null;

  return composeAdvertisement({
    backgroundImageBuffer,
    renderPlan,
    copy:         commercialCopy,
    typography:   commercialTypography,
    brandContext: { primaryColor },
    assetBuffers,
    outputFormat: options?.outputFormat,
    quality:      options?.quality,
    contactBarText: options?.contactBarText,
    splitLayout: options?.splitLayout,
    // This wrapper is specifically the top-photo/bottom-text poster
    // convention (the whole background-zone-check.ts + clean-background-
    // prompt.ts effort was built around it) — safe to always reserve the
    // bottom band here. composeAdvertisement() itself defaults this off so
    // other renderPlan layouts (e.g. a left-third hero) are unaffected.
    reserveBottomBand: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom-band matting (reserveBottomBand)
// ─────────────────────────────────────────────────────────────────────────────
//
// Reliability fix — two rounds of prompt tuning (v4, v5) both failed to get
// the AI photo generator to reliably leave empty "footroom" below the
// subject: 0/4 real pass rate both times, because empty space below a
// mid-frame torso has almost no precedent in real photography for the model
// to draw on (unlike headroom above a subject, which is common and did
// respond to prompt tuning — 3/4 real pass rate). Cropping is not an option
// for the TOP zone (it would cut into the subject's own head), but it is a
// completely normal, invisible edit for the BOTTOM zone — photos cropped at
// the chest or waist look ordinary. So the bottom margin is now guaranteed
// in code instead of requested from the model: crop the photo to a shorter,
// top-anchored box and matte the remainder, rather than relying on the
// generator to leave it blank.

/**
 * Crops the background photo to the space above the render plan's
 * bottom-anchored text elements (or, in split-layout mode, to a fixed
 * fraction of canvas height), then fills the remaining canvas rows with a
 * color derived from the photo's own lower edge so the seam blends.
 */
async function buildMattedBackground(
  backgroundImageBuffer: Buffer,
  canvas: CanvasSize,
  renderPlan: CommercialRenderPlan,
  accentColor: string,
  splitLayout?: { photoZoneFraction: number },
): Promise<Buffer> {
  // Split-layout mode forces the photo/color boundary to a fixed fraction
  // instead of deriving it from renderPlan's bottom-anchored elements —
  // the color zone now also holds headline/subheadline/benefits (shifted
  // there by the caller), not just CTA/footer, so computeMatteTop's
  // renderPlan-derived value (which only looks at cta/footer/etc.) would
  // put the boundary far too low.
  const matteTop = splitLayout
    ? Math.round(canvas.height * splitLayout.photoZoneFraction)
    : computeMatteTop(canvas, renderPlan);

  // position:"top" is the detail that makes this safe — cover-fit cropping
  // defaults to a centered crop, which would cut into the top of the frame
  // (and the already-verified head framing) just as readily as the bottom.
  // Anchoring to the top means only the excess below the reserved line is
  // ever removed.
  const croppedPhoto = await sharp(backgroundImageBuffer)
    .resize(canvas.width, matteTop, { fit: "cover", position: "top" })
    .toBuffer();

  const matteColor = await sampleBottomEdgeColor(croppedPhoto, canvas.width, matteTop);
  const feather = buildFeatherGradient(canvas, matteTop, matteColor);

  // Phase 1's band gradient was tuned for a small strip (~15-35% of
  // canvas) where the goal was subtle depth: low tint toward the brand
  // color, blended gradually across the whole band. Split-layout's color
  // zone is roughly half the canvas and needs to read as a genuine color
  // block (matching the reference posters), not a long photographic fade —
  // so it uses a much higher tint ratio and a short transition distance
  // instead, reusing the exact same gradient-building mechanism.
  const gradientBase = splitLayout
    ? buildMatteGradientBase(canvas, matteTop, matteColor, accentColor, {
        tintRatio: 0.92,
        darkenRatio: 0.1,
        transitionPx: Math.round(canvas.height * 0.12),
      })
    : buildMatteGradientBase(canvas, matteTop, matteColor, accentColor, {
        tintRatio: 0.22,
        darkenRatio: 0.18,
        transitionPx: null, // null = blend across the entire remaining band, today's existing behavior
      });

  return sharp(gradientBase)
    .composite([
      { input: croppedPhoto, top: 0, left: 0 },
      { input: feather.svgBuffer, top: matteTop - feather.height, left: 0 },
    ])
    .png()
    .toBuffer();
}

// Full-canvas gradient rendered as its own SVG and rasterized — replaces
// the flat `sharp({create:...})` base. Rows above matteTop are entirely
// covered by the photo composited on top, so the gradient there is never
// actually seen; only matteTop..canvas.height (the visible matte) shows
// the transition. The top stop always matches matteColor exactly (the
// seam the feather blend above fades into — never changes), and either
// blends gradually to `bottom` across the whole remaining band
// (transitionPx null — Phase 1's subtle-band look) or resolves to `bottom`
// within a short, fixed distance and stays flat for the rest (split
// layout's color-block look).
function buildMatteGradientBase(
  canvas: CanvasSize,
  matteTop: number,
  matteColor: { r: number; g: number; b: number },
  accentColor: string,
  params: { tintRatio: number; darkenRatio: number; transitionPx: number | null },
): Buffer {
  const bottom = mixAndDarken(matteColor, hexToRgb(accentColor), params.tintRatio, params.darkenRatio);
  const seamOffsetPct = (matteTop / canvas.height) * 100;

  const stops =
    params.transitionPx === null
      ? [
          { offset: 0, color: matteColor },
          { offset: seamOffsetPct, color: matteColor },
          { offset: 100, color: bottom },
        ]
      : [
          { offset: 0, color: matteColor },
          { offset: seamOffsetPct, color: matteColor },
          { offset: Math.min(100, ((matteTop + params.transitionPx) / canvas.height) * 100), color: bottom },
          { offset: 100, color: bottom },
        ];

  const stopTags = stops
    .map((s) => `<stop offset="${s.offset.toFixed(2)}%" stop-color="rgb(${s.color.r},${s.color.g},${s.color.b})"/>`)
    .join("");

  const svg =
    `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs><linearGradient id="matte" x1="0" y1="0" x2="0" y2="1">${stopTags}</linearGradient></defs>` +
    `<rect width="${canvas.width}" height="${canvas.height}" fill="url(#matte)"/>` +
    `</svg>`;
  return Buffer.from(svg);
}

// Blends `base` toward `tint` by `tintRatio` (0-1), then darkens the
// result by `darkenRatio` (0-1). Used to derive the matte gradient's
// bottom-stop color and every Phase 1 accent shape from one resolved
// brand color, so they all read as coordinated rather than arbitrary.
function mixAndDarken(
  base: { r: number; g: number; b: number },
  tint: { r: number; g: number; b: number },
  tintRatio: number,
  darkenRatio: number,
): { r: number; g: number; b: number } {
  const mix = (a: number, b: number) => a * (1 - tintRatio) + b * tintRatio;
  return {
    r: Math.round(mix(base.r, tint.r) * (1 - darkenRatio)),
    g: Math.round(mix(base.g, tint.g) * (1 - darkenRatio)),
    b: Math.round(mix(base.b, tint.b) * (1 - darkenRatio)),
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]! : h.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return { r: isNaN(r) ? 26 : r, g: isNaN(g) ? 86 : g, b: isNaN(b) ? 219 : b };
}

// Short feather at the seam — fades the sampled matte color in over the
// photo's last few rows instead of a hard cut, so the transition reads as a
// soft vignette rather than a visible edge. Deliberately simple (a single
// two-stop gradient, no multi-stop fade): the goal is "the seam disappears,"
// not an elaborate effect.
function buildFeatherGradient(
  canvas: CanvasSize,
  matteTop: number,
  color: { r: number; g: number; b: number },
): { svgBuffer: Buffer; height: number } {
  const height = Math.min(matteTop, Math.max(20, Math.round(canvas.height * 0.03)));
  const { r, g, b } = color;
  const svg =
    `<svg width="${canvas.width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs><linearGradient id="feather" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="rgb(${r},${g},${b})" stop-opacity="0"/>` +
    `<stop offset="100%" stop-color="rgb(${r},${g},${b})" stop-opacity="1"/>` +
    `</linearGradient></defs>` +
    `<rect width="${canvas.width}" height="${height}" fill="url(#feather)"/>` +
    `</svg>`;
  return { svgBuffer: Buffer.from(svg), height };
}

// Derived from the render plan's own bottom-anchored elements (they're
// already computed "working upward from safeBottom" — see render-plan.ts)
// rather than a fixed fraction, so the reserved band tracks what this
// specific poster's copy actually needs instead of a one-size-fits-all
// guess. Clamped to a sane range as a guard against a pathological plan.
function computeMatteTop(canvas: CanvasSize, renderPlan: CommercialRenderPlan): number {
  const candidateYs = [
    renderPlan.cta.y,
    renderPlan.secondaryCta?.y,
    renderPlan.socialProof?.y,
    renderPlan.disclaimer?.y,
    renderPlan.footer.y,
  ].filter((y): y is number => typeof y === "number");

  const rawMatteTop = candidateYs.length > 0 ? Math.min(...candidateYs) : canvas.height * 0.75;

  const minMatteTop = canvas.height * 0.65;
  const maxMatteTop = canvas.height * 0.85;
  return Math.round(Math.min(Math.max(rawMatteTop, minMatteTop), maxMatteTop));
}

// Flat color sampled from a thin strip near the photo's new bottom edge —
// deliberately simple for v1 (no gradient) per the product decision to not
// over-build before seeing how the flat blend actually looks.
async function sampleBottomEdgeColor(
  photoBuffer: Buffer,
  width: number,
  height: number,
): Promise<{ r: number; g: number; b: number }> {
  const stripHeight = Math.max(1, Math.round(height * 0.05));
  const top = Math.max(0, height - stripHeight);

  const { data } = await sharp(photoBuffer)
    .extract({ left: 0, top, width, height: stripHeight })
    .resize(1, 1)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { r: data[0], g: data[1], b: data[2] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper
// ─────────────────────────────────────────────────────────────────────────────

function mimeTypeFor(
  fmt: OutputFormat,
): "image/png" | "image/jpeg" | "image/webp" {
  if (fmt === "jpeg") return "image/jpeg";
  if (fmt === "webp") return "image/webp";
  return "image/png";
}
