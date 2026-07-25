// Phase 8 — Layout Director.
//
// Thinks like a magazine designer. Takes Design Director + Typography Director
// output and produces exact region definitions for every element:
//   headline region · hero region · CTA region · logo region · footer region
// Every element has a reserved area before image generation begins.

import type { DesignDirectorOutput, TypographyDirectorOutput, LayoutDirectorOutput, LayoutRegion } from "./types";

// ─── Region builders by aspect ratio ─────────────────────────────────────────

interface RawRegion {
  verticalStart: number;  // % from top
  verticalEnd:   number;  // % from top
  priority:      number;
  contents:      string[];
}

interface RegionSet {
  headline: RawRegion;
  hero:     RawRegion;
  cta:      RawRegion;
  logo:     RawRegion;
  footer:   RawRegion;
}

function buildPortraitRegions(design: DesignDirectorOutput): RegionSet {
  // 9:16 — vertical layout
  // Top zone: headline (derived from negativeSpace.top)
  const topPct = parseInt(design.negativeSpace.top, 10) || 25;

  // Bottom zone: CTA + footer (derived from negativeSpace.bottom)
  const bottomPct    = parseInt(design.negativeSpace.bottom, 10) || 16;
  const footerPct    = Math.round(bottomPct * 0.5);    // footer is bottom half of the bottom zone
  const ctaStart     = 100 - bottomPct;
  const footerStart  = 100 - footerPct;

  return {
    headline: {
      verticalStart: 0,
      verticalEnd:   topPct,
      priority:      10,
      contents:      ["Primary headline", "Sub-headline (if any)"],
    },
    hero: {
      verticalStart: topPct,
      verticalEnd:   ctaStart,
      priority:      9,
      contents:      ["Hero visual scene", "Secondary subjects", "Environment and atmosphere"],
    },
    cta: {
      verticalStart: ctaStart,
      verticalEnd:   footerStart,
      priority:      9,
      contents:      ["Primary CTA button", "CTA supporting text (if any)"],
    },
    logo: {
      verticalStart: footerStart,
      verticalEnd:   100,
      priority:      7,
      contents:      ["Brand logo"],
    },
    footer: {
      verticalStart: footerStart,
      verticalEnd:   100,
      priority:      6,
      contents:      ["Logo", "Website", "Contact / address (if required)"],
    },
  };
}

function buildSquareRegions(design: DesignDirectorOutput): RegionSet {
  // 1:1 — compressed vertical stack
  const topPct    = Math.round((parseInt(design.negativeSpace.top, 10) || 24) * 0.8);
  const bottomPct = Math.round((parseInt(design.negativeSpace.bottom, 10) || 15) * 0.85);
  const ctaStart  = 100 - bottomPct;
  const footerStart = 100 - Math.round(bottomPct * 0.45);

  return {
    headline: { verticalStart: 0,       verticalEnd: topPct,      priority: 10, contents: ["Primary headline"] },
    hero:     { verticalStart: topPct,  verticalEnd: ctaStart,    priority:  9, contents: ["Hero visual", "Supporting scene"] },
    cta:      { verticalStart: ctaStart,verticalEnd: footerStart,  priority:  9, contents: ["CTA button"] },
    logo:     { verticalStart: footerStart, verticalEnd: 100,     priority:  7, contents: ["Logo"] },
    footer:   { verticalStart: footerStart, verticalEnd: 100,     priority:  6, contents: ["Logo", "Website"] },
  };
}

function buildLandscapeRegions(design: DesignDirectorOutput): RegionSet {
  // 16:9 — horizontal split: text left, hero right
  // Left column: 0-35% (headline + CTA stacked)
  // Right column: 35-100% (hero)
  const topPct = parseInt(design.negativeSpace.top, 10) || 25;

  return {
    headline: { verticalStart: 0,    verticalEnd: topPct, priority: 10, contents: ["Headline (left column, upper third)"] },
    hero:     { verticalStart: 0,    verticalEnd: 100,    priority:  9, contents: ["Hero visual (right 65% of frame)"] },
    cta:      { verticalStart: 65,   verticalEnd: 85,     priority:  9, contents: ["CTA (left column, lower)"] },
    logo:     { verticalStart: 88,   verticalEnd: 100,    priority:  7, contents: ["Logo (bottom left)"] },
    footer:   { verticalStart: 88,   verticalEnd: 100,    priority:  6, contents: ["Logo", "Contact"] },
  };
}

// ─── Region label builder ─────────────────────────────────────────────────────

function toLayoutRegion(label: string, raw: RawRegion): LayoutRegion {
  const height = raw.verticalEnd - raw.verticalStart;
  const zone   = height >= 40
    ? `${label} (${raw.verticalStart}%–${raw.verticalEnd}%)`
    : `${label} — ${height}% zone starting at ${raw.verticalStart}%`;
  return {
    zone,
    verticalStart: `${raw.verticalStart}%`,
    verticalEnd:   `${raw.verticalEnd}%`,
    priority:      raw.priority,
    contents:      raw.contents,
  };
}

// ─── Safe margins ─────────────────────────────────────────────────────────────

function buildSafeMargins(design: DesignDirectorOutput, typography: TypographyDirectorOutput): {
  top: string; bottom: string; left: string; right: string;
} {
  // Margins combine design negative space with typography safe zones
  const headlineDom = typography.headline.dominance;
  const leftMargin  = design.negativeSpace.left;
  const rightMargin = design.balance === "left-heavy"
    ? design.negativeSpace.right
    : design.negativeSpace.left;

  // Higher headline dominance → enforce the top margin strictly
  const topNote = headlineDom >= 9
    ? `${design.negativeSpace.top} — strictly enforced, maximum headline breathing room`
    : design.negativeSpace.top;

  return {
    top:    topNote,
    bottom: design.negativeSpace.bottom,
    left:   leftMargin,
    right:  rightMargin,
  };
}

// ─── Visual rhythm derivation ──────────────────────────────────────────────────

function deriveVisualRhythm(design: DesignDirectorOutput, aspectRatio: string): string {
  if (aspectRatio === "16:9") {
    return "Left-to-right: headline and CTA on the left anchor the story; hero scene commands the right two-thirds";
  }
  if (design.balance === "centered") {
    return "Top-to-bottom: headline sets the expectation, hero scene delivers the promise, CTA closes the conversation";
  }
  return "Top-to-bottom: headline descends into the visual world, eye flows through the hero, CTA grounds the action";
}

function deriveAlignmentGuide(design: DesignDirectorOutput): string {
  const leftPct = parseInt(design.negativeSpace.left, 10) || 10;
  if (design.balance === "left-heavy") {
    return `Primary alignment axis at ${leftPct}% from left edge. Headline, CTA, and logo anchor to this vertical line. Hero scene occupies right of center.`;
  }
  if (design.balance === "centered") {
    return "Central axis symmetry — headline, hero, and CTA all center-aligned. Balance is architectural.";
  }
  return `Mixed alignment — headline left-anchored, hero centered, CTA centered or left-aligned.`;
}

// ─── ASCII layout builder ─────────────────────────────────────────────────────

function buildAsciiLayout(
  regions: RegionSet,
  reading: string[],
  aspectRatio: string,
): string {
  const W = 32;
  const bar = "─".repeat(W);

  if (aspectRatio === "16:9") {
    return [
      `+${"─".repeat(14)} LANDSCAPE ${"─".repeat(14)}+`,
      `│  HEADLINE     │     HERO SCENE          │`,
      `│  CTA          │     Subject              │`,
      `│  Logo         │     Environment          │`,
      `+${"─".repeat(W + 6)}+`,
    ].join("\n");
  }

  const flowItems = reading.slice(0, 7);
  const lines: string[] = [];
  lines.push(`+${bar}+`);
  lines.push(`│${" HEADLINE".padEnd(W)}│`);
  lines.push(`│${bar}│`);

  const heroItems = flowItems.filter(
    f => !["Headline", "CTA", "Logo"].includes(f)
  );
  for (const item of heroItems) {
    lines.push(`│  ${item.padEnd(W - 2)}│`);
  }
  lines.push(`│${bar}│`);
  lines.push(`│${"  CTA".padEnd(W)}│`);
  lines.push(`│${"  Logo  ·  Website  ·  Contact".padEnd(W)}│`);
  lines.push(`+${bar}+`);

  return lines.join("\n");
}

// ─── Main function ────────────────────────────────────────────────────────────

export function buildLayoutDirectorOutput(
  design: DesignDirectorOutput,
  typography: TypographyDirectorOutput,
  aspectRatio: "9:16" | "1:1" | "16:9" = "9:16",
): LayoutDirectorOutput {
  const raw = aspectRatio === "16:9"
    ? buildLandscapeRegions(design)
    : aspectRatio === "1:1"
      ? buildSquareRegions(design)
      : buildPortraitRegions(design);

  const regions = {
    headline: toLayoutRegion("Headline zone", raw.headline),
    hero:     toLayoutRegion("Hero zone",     raw.hero),
    cta:      toLayoutRegion("CTA zone",      raw.cta),
    logo:     toLayoutRegion("Logo zone",     raw.logo),
    footer:   toLayoutRegion("Footer zone",   raw.footer),
  };

  return {
    regions,
    safeMargins:    buildSafeMargins(design, typography),
    visualRhythm:   deriveVisualRhythm(design, aspectRatio),
    alignmentGuide: deriveAlignmentGuide(design),
    asciiLayout:    buildAsciiLayout(raw, design.readingFlow, aspectRatio),
  };
}
