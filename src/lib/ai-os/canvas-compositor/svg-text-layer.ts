// Phase 9.3 — SVG Text Layer Builder.
// Builds a single transparent full-canvas SVG containing every text element.
// This SVG is composited over the background image by sharp in one pass.
// Pure function — no I/O, deterministic.

import type { CommercialRenderPlan, CTARegion } from "../commercial-renderer/types";
import type { CommercialCopy }            from "../copy-intelligence/types";
import type {
  CommercialTypographyPlan,
  ElementTypography,
  TypographySize,
  LineHeightScale,
} from "../typography-intelligence/types";
import {
  resolveFontFamily, resolveWeight,
  resolveLetterSpacingPx, applyTextTransform, resolveBulletGlyph,
} from "./font-resolver";
import {
  resolveTextColor, resolveShadowOpacity,
  resolveCTAButtonColor, hexToSvgRgba,
} from "./color-resolver";
import { renderIcon, ICON_ROTATION } from "./icons";

// ─────────────────────────────────────────────────────────────────────────────
// Reference tables (mirrors text-layout-engine constants)
// ─────────────────────────────────────────────────────────────────────────────

const BASE_SIZE_PX: Record<TypographySize, number> = {
  xs: 14, sm: 17, base: 20, lg: 26, xl: 34, xxl: 46, display: 62,
};

const LINE_HEIGHT_MULT: Record<LineHeightScale, number> = {
  tight: 1.2, snug: 1.35, normal: 1.5, relaxed: 1.65, loose: 1.9,
};

function sizeToPixels(size: TypographySize, scale: number): number {
  return Math.round(BASE_SIZE_PX[size] * scale);
}

function lineHeightPx(size: TypographySize, lh: LineHeightScale, scale: number): number {
  return Math.round(sizeToPixels(size, scale) * LINE_HEIGHT_MULT[lh]);
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG escaping
// ─────────────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─────────────────────────────────────────────────────────────────────────────
// Shadow filter declaration
// ─────────────────────────────────────────────────────────────────────────────

function shadowFilter(id: string, opacity: number): string {
  if (opacity <= 0) return "";
  return `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%">
    <feDropShadow dx="0" dy="1" stdDeviation="3"
                  flood-color="rgba(0,0,0,${opacity.toFixed(2)})"/>
  </filter>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Text anchor helpers
// ─────────────────────────────────────────────────────────────────────────────

function textAnchorFor(alignment: string): string {
  if (alignment === "right"   || alignment === "end")    return "end";
  if (alignment === "center"  || alignment === "middle") return "middle";
  return "start";
}

function baselineX(
  alignment: string,
  regionX:   number,
  regionW:   number,
): number {
  if (alignment === "right")  return regionX + regionW;
  if (alignment === "center") return regionX + Math.round(regionW / 2);
  return regionX;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single text element (one or more lines)
// ─────────────────────────────────────────────────────────────────────────────

function renderText(
  lines:     string[],
  region:    { x: number; y: number; width: number; height: number; alignment: string },
  typo:      ElementTypography,
  scale:     number,
  fontFamily: string,
  filterId:  string,
): string {
  if (lines.length === 0) return "";

  const fontSize  = sizeToPixels(typo.size, scale);
  const lhPx      = lineHeightPx(typo.size, typo.lineHeight, scale);
  const weight    = resolveWeight(typo.weight);
  const fill      = resolveTextColor(typo.contrast);
  const opacity   = (typo.opacity / 100).toFixed(2);
  const anchor    = textAnchorFor(region.alignment);
  const tx        = baselineX(region.alignment, region.x, region.width);
  const lsPx      = resolveLetterSpacingPx(typo.letterSpacing, fontSize);
  const filterRef = filterId ? `filter="url(#${filterId})"` : "";
  const lsAttr    = lsPx !== 0 ? `letter-spacing="${lsPx}"` : "";

  // First line baseline: y + fontSize * 0.85 (cap-height from top approximation)
  const y0 = region.y + Math.round(fontSize * 0.85);

  return lines.map((line, i) => `<text
      x="${tx}" y="${y0 + lhPx * i}"
      font-family="${fontFamily}" font-size="${fontSize}" font-weight="${weight}"
      fill="${fill}" text-anchor="${anchor}" opacity="${opacity}"
      ${lsAttr} ${filterRef}>${esc(line)}</text>`).join("\n  ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Benefits grid (multi-column)
// ─────────────────────────────────────────────────────────────────────────────

function renderBenefits(
  benefits:  string[],
  region:    CommercialRenderPlan["benefits"],
  typo:      CommercialTypographyPlan["benefits"],
  scale:     number,
  fontFamily: string,
  filterId:  string,
): string {
  if (benefits.length === 0) return "";

  const fontSize  = sizeToPixels(typo.size, scale);
  const lhPx      = lineHeightPx(typo.size, typo.lineHeight, scale);
  const weight    = resolveWeight(typo.weight);
  const fill      = resolveTextColor(typo.contrast);
  const opacity   = (typo.opacity / 100).toFixed(2);
  const filterRef = filterId ? `filter="url(#${filterId})"` : "";
  const bullet    = resolveBulletGlyph(typo.bulletStyle);
  const columns   = region.columns;
  const colWidth  = region.columnWidth;
  const colSpacing = region.columnSpacing;
  const y0        = region.y + Math.round(fontSize * 0.85);

  const parts: string[] = [];

  benefits.forEach((text, idx) => {
    const col    = idx % columns;
    const row    = Math.floor(idx / columns);
    const x      = region.x + col * (colWidth + colSpacing);
    const y      = y0 + row * lhPx;
    const label  = applyTextTransform(bullet + text, typo.textTransform);

    parts.push(`<text
      x="${x}" y="${y}"
      font-family="${fontFamily}" font-size="${fontSize}" font-weight="${weight}"
      fill="${fill}" opacity="${opacity}"
      ${filterRef}>${esc(label)}</text>`);
  });

  return parts.join("\n  ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Benefit chips (single-row icon + 2-line label strip — Phase 2a split layout)
// ─────────────────────────────────────────────────────────────────────────────
//
// Replaces the 2-column/2-row plain-text grid (renderBenefits above) for the
// split-layout poster. Sized computationally, not guessed: a 2-row plain-text
// grid measured ~306px tall for real campaigns, which doesn't fit the
// shrunk color zone alongside headline/subheadline; a single row of 4
// compact chips measures ~150-160px — verified across 5 real campaigns
// before this was built, not assumed. Deliberately a single row spanning
// the full zone width (not a 2x2 grid, which the same measurement showed
// does NOT fit) and not a literal copy of any one reference poster's
// stacked-column chip list — that device was built for a narrow tall
// column; ours is a wide short zone, so a horizontal strip is the shape
// that actually fits this geometry.
//
// Up to 4 benefits are shown (a poster showing more than 4 already doesn't
// fit today's plain-text grid either — not a new limitation). Icons cycle
// through ICON_ROTATION in a fixed order — no content-matching to pick a
// semantically "right" icon per benefit yet; that's real future work, not
// something to fake here.
function renderBenefitChips(
  benefits:   string[],
  region:     { x: number; y: number; width: number },
  typo:       CommercialTypographyPlan["benefits"],
  scale:      number,
  fontFamily: string,
  accentColor: string,
  filterId:   string,
): string {
  if (benefits.length === 0) return "";

  const items = benefits.slice(0, 4);
  const count = items.length;

  const fontSize  = sizeToPixels(typo.size, scale);
  const lhPx      = lineHeightPx(typo.size, typo.lineHeight, scale);
  const weight    = resolveWeight(typo.weight);
  const fill      = resolveTextColor(typo.contrast);
  const opacity   = (typo.opacity / 100).toFixed(2);
  const filterRef = filterId ? `filter="url(#${filterId})"` : "";

  const gap          = Math.round(20 * scale);
  const iconDiameter = Math.round(32 * scale);
  const iconTextGap  = Math.round(10 * scale);
  const chipWidth    = Math.round((region.width - gap * (count - 1)) / count);
  const textColWidth = Math.max(20, chipWidth - iconDiameter - iconTextGap);
  // Same character-count heuristic already used for headline wrapping above
  // (not exact font-metric measurement) — sized for real benefit text
  // lengths in verification, but re-checked against the actual render, not
  // trusted blind.
  const maxCharsPerLine = Math.max(6, Math.round(textColWidth / (fontSize * 0.52)));

  const parts: string[] = [];

  items.forEach((text, idx) => {
    const chipX = region.x + idx * (chipWidth + gap);
    const iconCx = chipX + Math.round(iconDiameter / 2);
    const iconCy = region.y + Math.round(iconDiameter / 2);

    parts.push(`<circle cx="${iconCx}" cy="${iconCy}" r="${Math.round(iconDiameter / 2)}" fill="${accentColor}"/>`);
    parts.push(renderIcon(ICON_ROTATION[idx % ICON_ROTATION.length]!, iconCx, iconCy, Math.round(iconDiameter * 0.55)));

    const lines = applyTextTransform(text, typo.textTransform)
      .split(" ")
      .reduce<string[]>((acc, word) => {
        const last = acc[acc.length - 1] ?? "";
        if (last.length + word.length + 1 <= maxCharsPerLine) {
          acc[acc.length - 1] = last ? `${last} ${word}` : word;
        } else {
          acc.push(word);
        }
        return acc;
      }, [""])
      .slice(0, 2);

    const textX = chipX + iconDiameter + iconTextGap;
    const y0 = region.y + Math.round(fontSize * 0.85);
    lines.forEach((line, li) => {
      parts.push(`<text
        x="${textX}" y="${y0 + li * lhPx}"
        font-family="${fontFamily}" font-size="${fontSize}" font-weight="${weight}"
        fill="${fill}" opacity="${opacity}"
        ${filterRef}>${esc(line)}</text>`);
    });
  });

  return parts.join("\n  ");
}

// ─────────────────────────────────────────────────────────────────────────────
// CTA button (rect + centered text)
// ─────────────────────────────────────────────────────────────────────────────

function renderCTAButton(
  ctaText:    string,
  region:     CTARegion,
  typo:       CommercialTypographyPlan["cta"],
  scale:      number,
  fontFamily: string,
  btnColor:   string,
): string {
  const fontSize  = sizeToPixels(typo.size, scale);
  const weight    = resolveWeight(typo.weight);
  const label     = applyTextTransform(ctaText, typo.textTransform);
  const rx        = region.borderRadius;

  // Text center
  const tx = region.x + Math.round(region.width  / 2);
  const ty = region.y + Math.round(region.height / 2);
  const textY = ty + Math.round(fontSize * 0.35); // approximate vertical centering

  return `
  <!-- CTA button -->
  <rect x="${region.x}" y="${region.y}" width="${region.width}" height="${region.height}"
        rx="${rx}" ry="${rx}" fill="${btnColor}"/>
  <text x="${tx}" y="${textY}"
        font-family="${fontFamily}" font-size="${fontSize}" font-weight="${weight}"
        fill="rgba(255,255,255,1)" text-anchor="middle">${esc(label)}</text>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Secondary CTA (outline style)
// ─────────────────────────────────────────────────────────────────────────────

function renderSecondaryCTA(
  ctaText:    string,
  region:     CTARegion,
  typo:       NonNullable<CommercialTypographyPlan["secondaryCta"]>,
  scale:      number,
  fontFamily: string,
  btnColor:   string,
): string {
  const fontSize = sizeToPixels(typo.size, scale);
  const weight   = resolveWeight(typo.weight);
  const label    = applyTextTransform(ctaText, typo.textTransform);
  const rx       = region.borderRadius;
  const tx       = region.x + Math.round(region.width / 2);
  const ty       = region.y + Math.round(region.height / 2);
  const textY    = ty + Math.round(fontSize * 0.35);

  return `
  <!-- Secondary CTA (outline) -->
  <rect x="${region.x}" y="${region.y}" width="${region.width}" height="${region.height}"
        rx="${rx}" ry="${rx}" fill="rgba(0,0,0,0.0)" stroke="${btnColor}" stroke-width="2"/>
  <text x="${tx}" y="${textY}"
        font-family="${fontFamily}" font-size="${fontSize}" font-weight="${weight}"
        fill="${btnColor}" text-anchor="middle">${esc(label)}</text>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main builder
// ─────────────────────────────────────────────────────────────────────────────

export interface SvgLayerOptions {
  brandPrimaryColor?: string | null;
  /**
   * Pre-formatted contact line (Problem 4 fix) — replaces the footer
   * region's generic "{industry} professional services" tagline when
   * present. Sourced from BrandKit/Profile by the caller
   * (compose-marketing-poster.ts's buildContactBarText); this module
   * doesn't know or care where the string came from.
   */
  contactBarText?: string | null;
  /**
   * Phase 2a split layout — renders benefits as a single row of icon +
   * 2-line-label chips (renderBenefitChips) instead of the default 2-column
   * plain-text grid (renderBenefits). Opt-in: false/undefined keeps every
   * existing caller's output byte-identical.
   */
  useBenefitChips?: boolean;
}

export function buildSvgTextLayer(
  renderPlan: CommercialRenderPlan,
  copy:       CommercialCopy,
  typography: CommercialTypographyPlan,
  options:    SvgLayerOptions = {},
): string {
  const { canvas } = renderPlan;
  const scale      = canvas.width / 1080;
  const fontFamily = resolveFontFamily(typography.typographyStyle);
  const btnColor   = resolveCTAButtonColor(options.brandPrimaryColor);

  // ── Define filters in <defs> ───────────────────────────────────────────────
  const headlineShadowOp  = resolveShadowOpacity(typography.headline.contrast);
  const ctaShadowOp       = resolveShadowOpacity(typography.cta.contrast);
  const benefitShadowOp   = resolveShadowOpacity(typography.benefits.contrast);
  const footerShadowOp    = resolveShadowOpacity(typography.footer.contrast);

  const defs = `<defs>
    ${shadowFilter("sh-headline",  headlineShadowOp)}
    ${shadowFilter("sh-cta",       ctaShadowOp)}
    ${shadowFilter("sh-benefit",   benefitShadowOp)}
    ${shadowFilter("sh-footer",    footerShadowOp)}
    ${renderPlan.subheadline && typography.subheadline  ? shadowFilter("sh-sub",        resolveShadowOpacity(typography.subheadline.contrast))  : ""}
    ${renderPlan.offer       && typography.offer        ? shadowFilter("sh-offer",      resolveShadowOpacity(typography.offer.contrast))         : ""}
    ${renderPlan.socialProof                            ? shadowFilter("sh-social",     resolveShadowOpacity(typography.socialProof.contrast))   : ""}
    ${renderPlan.disclaimer  && typography.disclaimer   ? shadowFilter("sh-disclaimer", resolveShadowOpacity(typography.disclaimer.contrast))    : ""}
  </defs>`;

  const parts: string[] = [];

  // ── Phase 1 decoration: border frame ─────────────────────────────────────────
  // A hairline frame in the same resolved brand/accent color as the CTA
  // button and the matte gradient (canvas-engine.ts) — the "premium
  // template" cue of a poster feeling intentionally framed. Inset from
  // the edges, never overlapping any text region, so this can't collide
  // with anything regardless of copy length.
  {
    const inset = Math.round(canvas.width * 0.01);
    const strokeW = Math.max(2, Math.round(2 * scale));
    const rx = Math.round(16 * scale);
    parts.push(
      `<rect x="${inset}" y="${inset}" width="${canvas.width - inset * 2}" height="${canvas.height - inset * 2}" ` +
        `rx="${rx}" ry="${rx}" fill="none" stroke="${btnColor}" stroke-opacity="0.85" stroke-width="${strokeW}"/>`
    );
  }

  // ── Phase 1 decoration: headline kicker bar ──────────────────────────────────
  // A short accent bar in the reserved empty space above the headline —
  // the space itself already exists (the head-position fix guarantees a
  // clear top margin), this just adds a small design mark inside it.
  // Never sits over text: positioned entirely above renderPlan.headline.y.
  {
    const barWidth = Math.round(70 * scale);
    const barHeight = Math.max(3, Math.round(6 * scale));
    const gapAboveHeadline = Math.round(24 * scale);
    const barX = renderPlan.headline.x + Math.round(renderPlan.headline.width / 2) - Math.round(barWidth / 2);
    const barY = Math.max(0, renderPlan.headline.y - gapAboveHeadline - barHeight);
    parts.push(
      `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="${Math.round(barHeight / 2)}" fill="${btnColor}"/>`
    );
  }

  // ── Headline ───────────────────────────────────────────────────────────────
  {
    const lines = applyTextTransform(copy.headline, typography.headline.textTransform)
      .split(" ")
      .reduce<string[]>((acc, word) => {
        const last = acc[acc.length - 1] ?? "";
        // Simple word-wrap: ~40 chars per line for display sizes, ~55 for others
        const maxChars = typography.headline.size === "display" || typography.headline.size === "xxl" ? 28 : 40;
        if (last.length + word.length + 1 <= maxChars) {
          acc[acc.length - 1] = last ? `${last} ${word}` : word;
        } else {
          acc.push(word);
        }
        return acc;
      }, [""])
      .slice(0, typography.headline.maxLines ?? 3);

    parts.push(renderText(lines, renderPlan.headline, typography.headline, scale, fontFamily, "sh-headline"));
  }

  // ── Subheadline ───────────────────────────────────────────────────────────
  if (renderPlan.subheadline && copy.subheadline && typography.subheadline) {
    const text = applyTextTransform(copy.subheadline, typography.subheadline.textTransform);
    parts.push(renderText([text], renderPlan.subheadline, typography.subheadline, scale, fontFamily, "sh-sub"));
  }

  // ── Offer ─────────────────────────────────────────────────────────────────
  if (renderPlan.offer && copy.offer && typography.offer) {
    const text = applyTextTransform(copy.offer, typography.offer.textTransform);
    parts.push(renderText([text], renderPlan.offer, typography.offer, scale, fontFamily, "sh-offer"));
  }

  // ── Benefits ──────────────────────────────────────────────────────────────
  parts.push(
    options.useBenefitChips
      ? renderBenefitChips(copy.benefits, renderPlan.benefits, typography.benefits, scale, fontFamily, btnColor, "sh-benefit")
      : renderBenefits(copy.benefits, renderPlan.benefits, typography.benefits, scale, fontFamily, "sh-benefit")
  );

  // ── Social proof ──────────────────────────────────────────────────────────
  if (renderPlan.socialProof && copy.socialProof.length > 0) {
    const text = copy.socialProof.join("  •  ");
    parts.push(renderText([text], renderPlan.socialProof, typography.socialProof, scale, fontFamily, "sh-social"));
  }

  // ── Phase 1 decoration: divider above CTA ────────────────────────────────────
  // A thin rule separating "information" (social proof) from "the action"
  // (CTA) — a small, fixed gap directly above the button rather than
  // trying to center in whatever space socialProof leaves, which varies
  // with copy length and risks the two colliding.
  {
    const dividerGap = Math.round(14 * scale);
    const dividerY = Math.max(0, renderPlan.cta.y - dividerGap);
    const dividerWidth = renderPlan.headline.width;
    const dividerX = renderPlan.headline.x;
    parts.push(
      `<line x1="${dividerX}" y1="${dividerY}" x2="${dividerX + dividerWidth}" y2="${dividerY}" ` +
        `stroke="${btnColor}" stroke-opacity="0.4" stroke-width="${Math.max(1, Math.round(1.5 * scale))}"/>`
    );
  }

  // ── CTA button ────────────────────────────────────────────────────────────
  parts.push(renderCTAButton(copy.cta, renderPlan.cta, typography.cta, scale, fontFamily, btnColor));

  // ── Secondary CTA ─────────────────────────────────────────────────────────
  if (renderPlan.secondaryCta && copy.secondaryCta && typography.secondaryCta) {
    parts.push(renderSecondaryCTA(
      copy.secondaryCta, renderPlan.secondaryCta,
      typography.secondaryCta, scale, fontFamily,
      hexToSvgRgba(btnColor, 0.9),
    ));
  }

  // ── Disclaimer ────────────────────────────────────────────────────────────
  if (renderPlan.disclaimer && copy.disclaimer && typography.disclaimer) {
    const text = applyTextTransform(copy.disclaimer, typography.disclaimer.textTransform);
    parts.push(renderText([text], renderPlan.disclaimer, typography.disclaimer, scale, fontFamily, "sh-disclaimer"));
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  {
    // Problem 4 fix — real BrandKit contact info (never AI-invented) takes
    // over this slot when available; the generic industry tagline remains
    // the fallback when there's nothing to show, rather than a blank
    // footer. Same region/position either way — no new geometry.
    const footerText =
      options.contactBarText ??
      (copy.metadata.industry
        ? `${copy.metadata.industry.toUpperCase()} PROFESSIONAL SERVICES`
        : "PROFESSIONAL SERVICES");
    const text = applyTextTransform(footerText, typography.footer.textTransform);
    parts.push(renderText([text], renderPlan.footer, typography.footer, scale, fontFamily, "sh-footer"));
  }

  // ── Assemble SVG ──────────────────────────────────────────────────────────
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
  ${defs}
  ${parts.join("\n  ")}
</svg>`;
}
