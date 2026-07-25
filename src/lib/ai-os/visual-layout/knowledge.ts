// Phase 6 — Visual Layout Intelligence Engine knowledge banks.
// Canvas specifications, grid systems, safe area rules, and composition
// principles that every Art Director has internalised. Pure data — no I/O.

// ─────────────────────────────────────────────────────────────────────────────
// Canvas specifications by platform
// ─────────────────────────────────────────────────────────────────────────────

export interface CanvasSpec {
  type: string;
  orientation: "portrait" | "landscape" | "square";
  aspectRatio: string;
  safeZone: string;
  margins: string;
  bleed: string;
  responsiveNote: string;
}

export const CANVAS_BY_PLATFORM: Record<string, CanvasSpec> = {
  instagram: {
    type: "social_post",
    orientation: "square",
    aspectRatio: "1:1",
    safeZone: "Keep all critical content within 5% inset from each edge; username and caption overlay bottom 10%",
    margins: "5% inner margin on all sides (approximately 54px at 1080px)",
    bleed: "digital — no bleed required",
    responsiveNote: "Content in bottom 10% risks being hidden by caption overlay on feed; avoid placing CTA there",
  },
  facebook: {
    type: "social_post",
    orientation: "landscape",
    aspectRatio: "1.91:1",
    safeZone: "Keep all critical content within 5% inset from each edge; text area limited to 20% of image per Meta guidance",
    margins: "5% inner margin all sides",
    bleed: "digital — no bleed required",
    responsiveNote: "May be cropped to 1:1 in feeds — ensure hero element is centred",
  },
  linkedin: {
    type: "social_post",
    orientation: "landscape",
    aspectRatio: "1.91:1",
    safeZone: "10% inset from all edges; professional content above the fold",
    margins: "5-8% inner margin",
    bleed: "digital — no bleed required",
    responsiveNote: "Mobile preview shows 1:1 crop — centre-weight all critical content",
  },
  story: {
    type: "story_vertical",
    orientation: "portrait",
    aspectRatio: "9:16",
    safeZone: "Top 14% (250px at 1080×1920) reserved for story UI; bottom 20% reserved for reply bar and reactions; safe zone is centre 66%",
    margins: "5% sides; 14% top; 20% bottom",
    bleed: "digital — no bleed required",
    responsiveNote: "All critical content must live in the centre 66% of the canvas or it will be obscured by platform UI",
  },
  poster: {
    type: "print_poster",
    orientation: "portrait",
    aspectRatio: "A4",
    safeZone: "10mm inset from trim on all sides minimum; all live copy within 15mm of trim",
    margins: "15mm all sides (live area), 10mm trim allowance, 3mm bleed",
    bleed: "3mm bleed required on all sides — extend background colour/image to edge + 3mm",
    responsiveNote: "Print design — maintain legibility at A4 reading distance (~30-40cm); headline minimum 24pt",
  },
  print: {
    type: "print_poster",
    orientation: "portrait",
    aspectRatio: "A4",
    safeZone: "10mm from trim on all sides",
    margins: "15mm all sides, 3mm bleed",
    bleed: "3mm bleed required",
    responsiveNote: "Ensure all text is within live area; images extend into bleed",
  },
  outdoor: {
    type: "outdoor_billboard",
    orientation: "landscape",
    aspectRatio: "6:1",
    safeZone: "15% inset from all sides — viewed at speed, generous safe zone critical",
    margins: "15% inner margin all sides",
    bleed: "Vendor-dependent — typically 100-200mm bleed all sides",
    responsiveNote: "3-second rule: only 7 words max, one dominant visual, maximum contrast — viewer is moving",
  },
  general: {
    type: "social_post",
    orientation: "square",
    aspectRatio: "1:1",
    safeZone: "5% inset from all edges",
    margins: "5% all sides",
    bleed: "digital — no bleed required",
    responsiveNote: "No specific platform constraints — design for centre-weighted legibility",
  },
};

export function getCanvasSpec(platform: string): CanvasSpec {
  return CANVAS_BY_PLATFORM[platform] ?? CANVAS_BY_PLATFORM.general;
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid systems by design style
// ─────────────────────────────────────────────────────────────────────────────

export interface GridSpec {
  system: string;
  columns: string;
  rows: string;
  spacing: string;
  alignment: string;
  note: string;
}

export const GRID_BY_STYLE: Record<string, GridSpec> = {
  editorial_clean: {
    system: "12_column_editorial",
    columns: "12",
    rows: "variable",
    spacing: "comfortable_16px_base",
    alignment: "left_aligned",
    note: "Magazine-style grid; generous internal margins; headline spans 8-10 columns; images bleed to column edges",
  },
  luxury_minimal: {
    system: "freeform_compositional",
    columns: "4",
    rows: "3",
    spacing: "ultra_generous_32px_plus",
    alignment: "centered",
    note: "Luxury layouts avoid rigid grids; elements float in generous negative space; asymmetry is intentional and refined",
  },
  corporate_professional: {
    system: "12_column_editorial",
    columns: "12",
    rows: "4",
    spacing: "tight_8px_base",
    alignment: "left_aligned",
    note: "Structured, predictable, credibility-first; strong baseline grid; all type aligns to 8px grid",
  },
  modern_bold: {
    system: "6_column_modular",
    columns: "6",
    rows: "variable",
    spacing: "comfortable_16px_base",
    alignment: "centered",
    note: "Bold modular grid; large type blocks; high contrast; deliberate whitespace used as design element",
  },
  warm_approachable: {
    system: "3_column_relaxed",
    columns: "3",
    rows: "3",
    spacing: "generous_24px_base",
    alignment: "centered",
    note: "Relaxed grid; rounded proportions; content blocks feel spacious and inviting; no harsh edges",
  },
  informational_structured: {
    system: "12_column_editorial",
    columns: "12",
    rows: "5",
    spacing: "tight_8px_base",
    alignment: "left_aligned",
    note: "Information-first grid; content blocks prioritise legibility; icons and data align on 8px grid",
  },
  dramatic_cinematic: {
    system: "freeform_compositional",
    columns: "6",
    rows: "variable",
    spacing: "generous_24px_base",
    alignment: "centered",
    note: "Cinematic compositions break the grid deliberately; type floats in white space; no visible structure",
  },
};

export function getGridSpec(designStyle: string): GridSpec {
  return GRID_BY_STYLE[designStyle] ?? GRID_BY_STYLE.editorial_clean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Safe area specifications by platform
// ─────────────────────────────────────────────────────────────────────────────

export const SAFE_AREA_SPECS: Record<string, string> = {
  instagram:  "Keep all critical content within 1080×866px (80% of 1080×1080) — bottom 214px overlaid by caption; sides clear to edge",
  facebook:   "Centre 80% of width; top 10% and bottom 10% may be clipped on mobile; keep hero and headline in centre 80%×80%",
  linkedin:   "Centre 80% of width; top 10% may show connection badges; keep logo and headline above vertical midpoint",
  story:      "Centre band from 14% top to 80% bottom (approx 1080×1260 at full res) — UI chrome above and below must stay clear",
  poster:     "10mm from all trim edges; bleed 3mm beyond trim; never place live copy in outer 10mm",
  print:      "10mm from all trim edges; 3mm bleed on all sides",
  youtube:    "Title-safe: 10% from all edges; action-safe: 5% from all edges; player controls occupy bottom 5% — avoid critical content there",
  outdoor:    "15% from all edges; lettering minimum 200mm high for legibility at 50m",
  general:    "5% inset from all edges as universal safe zone",
};

// ─────────────────────────────────────────────────────────────────────────────
// Visual weight distribution by luxury level
// ─────────────────────────────────────────────────────────────────────────────

export const NEGATIVE_SPACE_BY_LUXURY: Record<string, string> = {
  none:         "10_to_20_percent",   // utility layouts pack content
  low:          "20_to_35_percent",   // consumer quality
  medium:       "35_to_50_percent",   // premium commercial
  high:         "50_to_65_percent",   // luxury editorial
  ultra_luxury: "65_plus_percent",    // ultra-luxury: space IS the message
};

// ─────────────────────────────────────────────────────────────────────────────
// Visual priority order by campaign category
// ─────────────────────────────────────────────────────────────────────────────

export const PRIORITY_ORDERS: Record<string, string[]> = {
  awareness:       ["hero_subject", "campaign_theme_visual", "supporting_elements", "brand_identity", "headline_area", "logo", "decorative"],
  lead_generation: ["hero_subject", "headline_area", "trust_signals", "cta_zone", "supporting_elements", "logo", "decorative"],
  sales:           ["offer_visual", "headline_area", "benefits_strip", "cta_zone", "trust_signals", "logo", "decorative"],
  education:       ["informative_visual", "headline_area", "information_blocks", "process_visual", "trust_signals", "cta_zone", "logo"],
  trust:           ["trust_visual", "credentials_block", "headline_area", "social_proof", "cta_zone", "logo", "decorative"],
  engagement:      ["hero_emotional_moment", "campaign_visual", "supporting_story", "brand_identity", "headline_area", "cta_zone", "logo"],
  before_after:    ["transformation_visual", "before_label", "after_label", "proof_statement", "cta_zone", "trust_signals", "logo"],
  event:           ["event_hero", "event_name_block", "date_time_block", "venue_block", "cta_zone", "logo", "decorative"],
};

export function getVisualPriorityOrder(campaignGoal: string, campaignCategory: string): string[] {
  return PRIORITY_ORDERS[campaignGoal]
    ?? PRIORITY_ORDERS[campaignCategory]
    ?? PRIORITY_ORDERS.awareness;
}

// ─────────────────────────────────────────────────────────────────────────────
// Depth layer descriptions by photography style
// ─────────────────────────────────────────────────────────────────────────────

export const DEPTH_LAYERS: Record<string, { foreground: string; midground: string; background: string; layers: string }> = {
  before_after:    { foreground: "comparison divider line and labels", midground: "both subject states at equal scale", background: "neutral gradient or brand colour field", layers: "three_layer_standard" },
  lifestyle:       { foreground: "props or partial subject elements", midground: "hero subject in natural activity", background: "environment softly blurred", layers: "three_layer_standard" },
  studio_product:  { foreground: "minimal — possibly shadow or reflection", midground: "hero product perfectly lit", background: "solid colour or gradient", layers: "two_layer_flat" },
  macro_detail:    { foreground: "element in extreme focus", midground: "primary subject", background: "deeply blurred, colour-implied", layers: "two_layer_flat" },
  editorial:       { foreground: "graphic element or text", midground: "hero visual", background: "editorial environment", layers: "three_layer_standard" },
  documentary:     { foreground: "environmental context", midground: "people in authentic interaction", background: "real-world setting", layers: "four_plus_layer_cinematic" },
  aerial:          { foreground: "none — camera is above", midground: "subject from above", background: "landscape or environment", layers: "two_layer_flat" },
};

export function getDepthLayers(photoStyle: string) {
  return DEPTH_LAYERS[photoStyle] ?? DEPTH_LAYERS.editorial;
}
