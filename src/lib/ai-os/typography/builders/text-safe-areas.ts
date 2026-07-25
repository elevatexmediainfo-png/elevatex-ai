import type { VisualLayoutPlan } from "../../visual-layout/types";
import type { TextSafeAreas } from "../types";
import { tf } from "./shared";

// Builder 7 — Text Safe Areas
// Sole responsibility: define the spatial zone for each text level,
// derived from the VisualLayoutPlan block positions.
// Reads exclusively from VisualLayoutPlan — the spatial source of truth.

export function buildTextSafeAreas(layout: VisualLayoutPlan): TextSafeAreas {
  const blocks = layout.blocks;
  const safeZones = layout.canvas.safeZones.value;

  const headlineSafeZone = (() => {
    const headlinePos = blocks.headlineBlock.value;
    const posMap: Record<string, string> = {
      above_hero:          "Upper zone above the hero visual — within canvas safe margin, no UI chrome overlap",
      overlaid_hero_bottom:"Lower third of the hero visual — use contrast-safe overlay (shadow or scrim) for legibility",
      below_hero:          "Zone immediately below the hero image — anchored to the visual, within the safe margin",
      beside_hero_right:   "Right half of the canvas — keep within 5% inset from right edge",
      beside_hero_left:    "Left half of the canvas — keep within 5% inset from left edge",
      centered_standalone: "Centered in the canvas with equal white space top and bottom — maximum visual focus",
    };
    const desc = posMap[headlinePos ?? ""] ?? `Headline zone at position "${headlinePos}" — maintain 5% inset from canvas edge`;
    return tf(desc, headlinePos !== "unknown" ? "high" : "medium",
      `Headline safe zone derived from layout blocks headline position "${headlinePos}"`);
  })();

  const bodySafeZone = (() => {
    const bodyPos = blocks.bodyBlock.value;
    if (bodyPos === "absent") return tf("absent — no body copy in this layout", "high",
      `Body copy absent per layout plan`);
    const posMap: Record<string, string> = {
      below_subheadline: "Zone below the subheadline — within the primary content column, above the CTA zone",
      right_column:      "Right column of the grid — body text flows vertically within the right 50% of the canvas",
      left_column:       "Left column — body text sits left, visual sits right",
      footer_zone:       "Lower section of the canvas above the CTA and footer strip",
    };
    const desc = posMap[bodyPos] ?? `Body zone at "${bodyPos}" — maintain column width and safe margin`;
    return tf(desc, bodyPos !== "unknown" ? "high" : "medium",
      `Body safe zone from layout blocks body position "${bodyPos}"`);
  })();

  const ctaSafeZone = (() => {
    const ctaPos = blocks.ctaBlock.value;
    const posMap: Record<string, string> = {
      bottom_center_prominent: "Centred in the lower quarter of the canvas — keep 8% clear above and below; button text within 5% inset",
      bottom_right_accent:     "Bottom-right anchor zone — right of centre, above the footer strip; button text fully within 5% inset",
      lower_third_centered:    "Centred in the lower third — generous breathing room above (away from body copy)",
      inline_with_offer:       "Inline with the offer section — CTA text immediately adjacent to offer visual or copy",
      floating_bottom:         "Floating above the bottom edge — avoid placing text within 10% of the canvas bottom",
    };
    const desc = posMap[ctaPos ?? ""] ?? `CTA zone at "${ctaPos}" — always within safe margin, fully tappable`;
    return tf(desc, ctaPos !== "unknown" ? "high" : "medium",
      `CTA safe zone from layout blocks CTA position "${ctaPos}"`);
  })();

  const logoSafeZone = (() => {
    const logoPos = blocks.logoBlock.value;
    const posMap: Record<string, string> = {
      top_left:     "Top-left corner — minimum 5% inset from canvas edges; clear zone of at least 1× logo height above and beside",
      top_right:    "Top-right corner — 5% inset; no text within 1× logo width to the left",
      top_center:   "Centred at the top — 5% from top edge; flanking text must not appear at the same vertical level",
      bottom_left:  "Bottom-left — 5% inset from bottom and left; above footer strip if present",
      bottom_right: "Bottom-right — 5% inset; above any footer disclaimer text",
      bottom_center:"Bottom-centre — 5% from bottom edge; centred horizontally",
    };
    const desc = posMap[logoPos ?? ""] ?? `Logo zone at "${logoPos}" — maintain clear exclusion zone around the mark`;
    return tf(desc, logoPos !== "unknown" ? "high" : "medium",
      `Logo safe zone from layout blocks logo position "${logoPos}"`);
  })();

  const disclaimerSafeZone = (() => {
    const footerPos = blocks.footerBlock.value;
    if (footerPos === "absent") return tf(
      "No disclaimer zone — footer absent in this layout. If legally required, integrate into the body copy area",
      "medium", `Footer block absent — no dedicated disclaimer zone`);
    return tf(
      `Bottom strip below the CTA — disclaimer text sits here, within safe margin. Must not overlap CTA zone. ${safeZones}`,
      "high",
      `Disclaimer in footer strip — always the lowest text element on the canvas`);
  })();

  return { headlineSafeZone, bodySafeZone, ctaSafeZone, logoSafeZone, disclaimerSafeZone };
}
