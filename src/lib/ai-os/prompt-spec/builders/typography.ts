import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { TypographyZones } from "../types";
import { psf, unknownPsf } from "./shared";

// Builder 9 — Typography Zones
// Zone reservations ONLY — no text content, no copy, no font names.
// Derived from Blueprint.layout.blocks + Blueprint.typography.textSafeAreas.

export function buildTypographyZones(bp: UniversalCampaignBlueprint): TypographyZones {
  const layout = bp.layout;
  const typography = bp.typography;

  const reservedHeadlineArea = (() => {
    const blockPos = layout.blocks.headlineBlock.value;
    const safeZone = typography.textSafeAreas.headlineSafeZone.value;
    const val = safeZone !== "unknown"
      ? `HEADLINE ZONE: ${safeZone.slice(0, 150)}`
      : `HEADLINE ZONE: ${blockPos !== "unknown" ? blockPos.replace(/_/g, " ") : "upper area"} — clear of competing visual elements`;
    return psf(val, "high", `[typography] Headline zone from layout blocks and text safe areas`);
  })();

  const reservedBodyArea = (() => {
    const blockPos = layout.blocks.bodyBlock.value;
    if (blockPos === "absent") return psf("BODY ZONE: absent — no body copy in this layout", "high", `[typography] Body block absent per layout plan`);
    const safeZone = typography.textSafeAreas.bodySafeZone.value;
    const val = safeZone !== "unknown"
      ? `BODY ZONE: ${safeZone.slice(0, 150)}`
      : `BODY ZONE: ${blockPos !== "unknown" ? blockPos.replace(/_/g, " ") : "below headline"} — adequate contrast for body text required`;
    return psf(val, "medium", `[typography] Body zone from layout blocks and text safe areas`);
  })();

  const reservedCtaArea = (() => {
    const blockPos = layout.blocks.ctaBlock.value;
    const safeZone = typography.textSafeAreas.ctaSafeZone.value;
    const val = safeZone !== "unknown"
      ? `CTA ZONE: ${safeZone.slice(0, 150)}`
      : `CTA ZONE: ${blockPos !== "unknown" ? blockPos.replace(/_/g, " ") : "lower center"} — high contrast required, sufficient tap target space`;
    return psf(val, "high", `[typography] CTA zone from layout blocks — always reserved`);
  })();

  const reservedLogoArea = (() => {
    const blockPos = layout.blocks.logoBlock.value;
    const safeZone = typography.textSafeAreas.logoSafeZone.value;
    const val = safeZone !== "unknown"
      ? `LOGO ZONE: ${safeZone.slice(0, 150)}`
      : `LOGO ZONE: ${blockPos !== "unknown" ? blockPos.replace(/_/g, " ") : "standard corner"} — clear exclusion zone, do not place visual elements here`;
    return psf(val, "high", `[typography] Logo zone — NEVER attempt to render actual brand logo in generation`);
  })();

  const reservedDisclaimerArea = (() => {
    const footerBlock = layout.blocks.footerBlock.value;
    const safeZone = typography.textSafeAreas.disclaimerSafeZone.value;
    if (footerBlock === "absent") return psf("DISCLAIMER ZONE: absent — no footer in this layout", "medium", `[typography] Footer absent per layout plan`);
    const val = safeZone !== "unknown"
      ? `DISCLAIMER ZONE: ${safeZone.slice(0, 150)}`
      : "DISCLAIMER ZONE: bottom strip — keep background uncluttered, legal text added in post-production";
    return psf(val, "medium", `[typography] Disclaimer zone from typography safe areas`);
  })();

  const platformTextSafetyNote = (() => {
    const note = layout.canvas.responsiveZones.value;
    if (note !== "unknown") return psf(`PLATFORM TEXT SAFETY: ${note.slice(0, 200)}`, "high",
      `[typography] Platform-specific text safety from canvas planning`);
    return unknownPsf("platformTextSafetyNote");
  })();

  return { reservedHeadlineArea, reservedBodyArea, reservedCtaArea, reservedLogoArea, reservedDisclaimerArea, platformTextSafetyNote };
}
