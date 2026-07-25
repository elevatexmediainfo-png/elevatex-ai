// Phase 10.6A — Enum-to-English conversion and punctuation cleanup.
//
// Every enum leak found in the 10.5B/10.5D audits (soft_diffused_shadow,
// minimal_line_icons, hero_dominant_others_small, top_right, catchlight_eyes,
// ...) is a raw internal StrategyField value inserted into prompt text
// without translation. This module converts every known enum to natural
// English, with a smart per-value dictionary where mechanical underscore
// expansion alone would read awkwardly, and a safe generic fallback for any
// enum not explicitly listed.

/** Known enum values across PromptSpecification/VisualScenePlan, hand-written
 *  to read as natural English rather than mechanically underscore-expanded. */
const ENUM_PHRASES: Record<string, string> = {
  // Hero
  full_frame_dominant: "filling the entire frame", two_thirds_dominant: "occupying two-thirds of the frame",
  half_frame: "occupying half the frame", one_third_frame: "occupying a third of the frame",
  small_contextual: "small and contextual within the frame",
  center_frame: "centred in the frame", left_third: "positioned in the left third of the frame",
  right_third: "positioned in the right third of the frame", upper_third: "positioned in the upper third of the frame",
  lower_third: "positioned in the lower third of the frame", full_bleed: "filling the frame edge to edge",
  diagonal_split: "set along a diagonal split of the frame",
  absolute_mandatory: "the unmistakable visual anchor of the frame", primary_anchor: "the primary visual anchor",
  strong_supporting: "a strong supporting presence",
  // Relationships / scale
  direct_interaction: "interacting directly", parallel_presence: "present in parallel, not interacting",
  contextual_background: "present only in the background", product_in_use: "shown actively in use",
  environment_only: "present only as part of the environment",
  same_scale: "at the same scale", hero_twice_as_large: "roughly twice the scale of everything else",
  hero_dominant_others_small: "dominant in scale, with everything else notably smaller",
  product_hero_human_secondary: "the product dominant in scale, with any person secondary",
  environment_subject_only: "the environment itself as the only subject",
  // Composition
  rule_of_thirds: "framed using the rule of thirds", centered_symmetry: "framed with centred symmetry",
  golden_ratio: "framed using golden-ratio proportions", leading_diagonal: "framed with a leading diagonal line",
  frame_within_frame: "framed within a frame", negative_space_dominant: "dominated by open negative space",
  edge_tension_asymmetric: "framed with asymmetric edge tension",
  top_heavy_hero: "weighted toward the top of the frame", bottom_anchored: "anchored toward the bottom of the frame",
  left_weighted: "weighted toward the left of the frame", right_weighted: "weighted toward the right of the frame",
  center_weighted: "weighted toward the centre of the frame", evenly_distributed: "evenly distributed across the frame",
  bilateral_symmetry: "bilaterally symmetric", deliberate_asymmetry: "deliberately asymmetric",
  radial_from_center: "radiating from the centre", translational_rhythm: "repeating in a steady rhythm",
  minimal_tight_content: "tightly framed with minimal open space", balanced_breathing_room: "framed with balanced breathing room",
  generous_editorial_space: "framed with generous editorial space", extreme_luxury_space: "framed with extreme, luxurious open space",
  flat_two_dimensional: "rendered with flat, two-dimensional depth", shallow_foreground_blur: "with a shallow, blurred foreground",
  three_layer_natural: "with natural foreground, middle, and background layers",
  four_layer_cinematic: "with four cinematic depth layers", extreme_depth_environmental: "with extreme environmental depth",
  // Camera
  eye_level: "at eye level", slightly_elevated: "from a slightly elevated position", high_angle: "from a high angle",
  low_angle_heroic: "from a low, heroic angle", overhead_flat_lay: "directly overhead, flat-lay style",
  ground_level: "from ground level",
  straight_on_direct: "straight-on and direct", three_quarter_view: "from a three-quarter view",
  side_profile: "in side profile", overhead_top_down: "from directly overhead, top-down",
  worm_eye_upward: "from a worm's-eye view looking upward", dutch_tilt_dynamic: "with a dynamic, tilted horizon",
  macro_intimate_detail: "in intimate macro detail", portrait_natural_compression: "with natural portrait compression",
  standard_authentic: "with standard, authentic optics", wide_environmental_scale: "with a wide, environmental scale",
  telephoto_compressed_elegance: "with elegant telephoto compression",
  extreme_close_up: "in extreme close-up", close_up: "in close-up", medium_shot: "in a medium shot",
  medium_wide: "in a medium-wide shot", wide_establishing: "in a wide establishing shot",
  // Lighting
  warm_intimate_golden: "warm, intimate, golden-toned light", cool_clinical_precise: "cool, clinical, precise light",
  soft_diffused_approachable: "soft, diffused, approachable light", dramatic_contrasty_luxury: "dramatic, high-contrast luxury light",
  bright_even_commercial: "bright, even commercial light", natural_authentic_ambient: "natural, authentic ambient light",
  hard_dramatic_shadows: "hard, dramatic shadows", soft_diffused_shadows: "soft, diffused shadows",
  minimal_shadowless: "almost no visible shadow", directional_subtle: "subtle, directional shadow",
  no_shadow_product: "no visible shadow", specular_product_highlight: "a specular highlight on the surface",
  catchlight_eyes: "a catchlight visible in the eyes", surface_material_reflection: "a soft reflection on the surface",
  environmental_reflection: "the surroundings reflected on the surface", minimal_matte_finish: "a minimal, matte finish",
  // Environment
  professional_studio: "a professional studio setting", lifestyle_real_world: "a real-world lifestyle setting",
  premium_interior: "a premium interior", outdoor_natural: "a natural outdoor setting",
  abstract_gradient: "a soft abstract backdrop", architectural_exterior: "an architectural exterior",
  controlled_product_table: "a controlled product surface",
  // Rendering
  hyperrealistic: "hyperrealistic", photorealistic: "photorealistic", photo_quality: "photo-quality",
  stylized_realism: "stylised realism", editorial_realism: "editorial realism",
  utility_functional: "plainly functional", professional_quality: "professional quality",
  premium_polished: "premium and polished", luxury_refined: "refined and luxurious",
  ultra_prestige_perfect: "at the highest level of prestige and finish",
  regional_commercial: "a regional commercial production", national_commercial: "a large-scale commercial production",
  global_campaign: "an internationally distributed production", award_winning_creative: "an award-recognised production",
  trade_editorial: "trade editorial", consumer_magazine: "consumer-magazine quality",
  luxury_editorial: "luxury editorial", art_direction: "gallery-level art direction",
  premium_stock_photo: "premium stock-photo quality", commercial_campaign_shoot: "a professionally lit product shoot",
  editorial_magazine_shoot: "an editorial magazine shoot", product_studio_shoot: "a controlled product-studio shoot",
  architectural_photography: "architectural photography",
  // Icons / misc
  minimal_line_icons: "simple line-art icons", filled_icons: "solid filled icons", none: "none visible",
  top_right: "the top-right corner", top_left: "the top-left corner",
  bottom_right: "the bottom-right corner", bottom_left: "the bottom-left corner",
};

function titleToLowerFirst(s: string): string {
  return s.length ? s[0].toLowerCase() + s.slice(1) : s;
}

/** Converts one raw enum-style token (snake_case) into natural English. */
export function naturalizeEnumToken(token: string): string {
  const key = token.trim().toLowerCase();
  if (ENUM_PHRASES[key]) return ENUM_PHRASES[key];
  // Generic fallback: underscore expansion. Still infinitely better than a
  // raw leak, even if less elegant than a hand-written phrase.
  return key.replace(/_/g, " ");
}

/** Finds and replaces every snake_case token (2+ underscore-joined words)
 *  anywhere inside a larger sentence, without disturbing surrounding prose. */
export function naturalizeEnumsInText(text: string): { text: string; leaksFixed: number } {
  const pattern = /\b[a-z]+(?:_[a-z]+){1,}\b/g;
  let leaksFixed = 0;
  const result = text.replace(pattern, (match) => {
    leaksFixed++;
    return naturalizeEnumToken(match);
  });
  return { text: result, leaksFixed };
}

export function countEnumLeaks(text: string): number {
  const matches = text.match(/\b[a-z]+(?:_[a-z]+){1,}\b/g);
  return matches ? matches.length : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Punctuation cleanup
// ─────────────────────────────────────────────────────────────────────────────

export function hasBrokenPunctuation(text: string): boolean {
  return /\.\.+/.test(text) || /,\s*,/.test(text) || /\{|\}|":/.test(text) || /\|/.test(text);
}

// Abbreviations that must never be split by the "space after period" rule.
const PROTECTED_ABBREVIATIONS = ["e.g.", "i.e.", "etc.", "vs."];

function protectAbbreviations(text: string): { text: string; placeholders: Map<string, string> } {
  const placeholders = new Map<string, string>();
  let result = text;
  PROTECTED_ABBREVIATIONS.forEach((abbr, i) => {
    const token = ` ABBR${i} `;
    if (result.toLowerCase().includes(abbr)) {
      result = result.replace(new RegExp(abbr.replace(/\./g, "\\."), "gi"), token);
      placeholders.set(token, abbr);
    }
  });
  return { text: result, placeholders };
}

function restoreAbbreviations(text: string, placeholders: Map<string, string>): string {
  let result = text;
  for (const [token, abbr] of placeholders) result = result.split(token).join(abbr);
  return result;
}

/** Collapses multi-period runs, double commas, stray pipe/enum separators,
 *  raw JSON-like artifacts, and immediately-repeated words (an artifact of
 *  enum phrases like "at eye level" landing after text that already says
 *  "positioned at") into clean prose punctuation. */
export function cleanPunctuation(text: string): string {
  const { text: protectedText, placeholders } = protectAbbreviations(text);
  const cleaned = protectedText
    .replace(/\.\.+/g, ".")               // "...." / ".." -> "."
    .replace(/,\s*,+/g, ",")              // double commas
    .replace(/\s*\|\s*/g, ", ")           // enum-style pipe separators -> comma
    .replace(/\{[^}]*\}/g, "")            // stray JSON object fragments
    .replace(/"[a-zA-Z0-9_]+"\s*:/g, "")  // stray "key": artifacts
    .replace(/\s+([.,])/g, "$1")          // no space before punctuation
    .replace(/([.,])(?=[^\s.,])/g, "$1 ") // ensure space after punctuation
    .replace(/\b(\w+)\s+\1\b/gi, "$1")    // collapse immediately-repeated words ("at at" -> "at")
    .replace(/\s{2,}/g, " ")              // collapse multiple spaces
    .trim();
  return restoreAbbreviations(cleaned, placeholders);
}

export { titleToLowerFirst };
