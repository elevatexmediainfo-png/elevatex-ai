// Phase 10.4A — Visual Realism Engine
//
// Replaces generic visual adjectives with physically observable photographic
// language that image models respond to more precisely.
//
// Rules:
//   1. Never invent campaign ideas — only improve vocabulary.
//   2. Never change composition, hero, or block structure.
//   3. Applied to lightingMood, colorPsychology, and the SCENE block context.
//      Never applied to heroSubject, primaryAction, or secondarySubjects.
//   4. Pure, synchronous, deterministic — no LLM, no I/O.

import type { SceneIndustry } from "./scene-builder";

// ─── Phrase substitution table ────────────────────────────────────────────────
// Ordered longest-match-first so multi-word patterns fire before their
// single-word suffixes (e.g., "warm ambient lighting" fires before "warm lighting").
// Patterns are case-insensitive.
// Conservative scope: standalone "luxury" and "premium" are NOT replaced because
// they often appear as establishment-tier descriptors ("premium restaurant") where
// substitution would corrupt meaning. Only compound quality forms are targeted.

const SUBSTITUTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  // ─── Lighting — compound patterns first ───────────────────────────────────
  [/\bwarm\s+ambient\s+light(?:ing)?\b/gi,          "3200K warm practical fill, natural shadow falloff"],
  [/\bnatural\s+ambient\s+light(?:ing)?\b/gi,       "5500K indirect window, diffused ambient fill"],
  [/\bclinical\s+(?:overhead\s+)?light(?:ing)?\b/gi, "4500K clinical LED overhead, neutral white-grey palette"],
  [/\bdramatic\s+light(?:ing)?\b/gi,                "single hard key source, deep shadow contrast"],
  [/\bcinematic\s+light(?:ing)?\b/gi,               "motivated practical source, strong key, deep shadow"],
  [/\bwarm\s+directional\s+light(?:ing)?\b/gi,      "3200K directional source, raking shadow on surface texture"],
  [/\bwarm\s+station\s+light(?:ing)?\b/gi,          "3000K station lamp, specular on surface material"],
  [/\bgolden\s+hour\s+light(?:ing)?\b/gi,           "3000K low angled sun, stretched warm shadow"],
  [/\bgolden\s+light\b/gi,                          "3000K angled sun, warm rim highlight"],
  [/\bnatural\s+light(?:ing)?\b/gi,                 "5500K indirect window daylight, soft ceiling bounce"],
  [/\bwarm\s+light(?:ing)?\b/gi,                    "3200K tungsten practicals, natural shadow falloff"],
  [/\bcool\s+light(?:ing)?\b/gi,                    "5500K daylight, crisp shadow edge"],
  [/\bsoft\s+light(?:ing)?\b/gi,                    "diffused wrap-light, feathered shadow edge"],
  [/\bdirectional\s+light(?:ing)?\b/gi,             "directional source, raking shadow on surface texture"],
  [/\bstation\s+light(?:ing)?\b/gi,                 "3000K station lamp, specular on surface"],
  [/\bambient\s+light(?:ing)?\b/gi,                 "diffused low fill, no dominant source direction"],

  // ─── Material / quality — compound forms only (safe, no standalone "luxury"/"premium") ──
  [/\bluxury\s+feel\b/gi,           "hand-finished surface, natural material variation"],
  [/\bluxury\s+look\b/gi,           "material weight visible, precision surface detail"],
  [/\bluxury\s+materials?\b/gi,     "hand-finished materials, natural imperfections visible"],
  [/\bluxury\s+aesthetic\b/gi,      "refined material craft, observable surface depth"],
  [/\bluxurious\b/gi,               "hand-crafted, natural imperfection, tactile weight"],
  [/\bpremium\s+quality\b/gi,       "micro-texture visible, accurate material light response"],
  [/\bpremium\s+feel\b/gi,          "surface tactility visible, material depth readable"],
  [/\bhigh-quality\b/gi,            "visible micro-texture, accurate light scattering"],
  [/\bhigh\s+quality\b/gi,          "visible material micro-texture, accurate reflectance"],
  [/\bhigh-end\b/gi,                "material grain and weight visible"],
  [/\bhigh\s+end\b/gi,              "material grain and weight visible"],
  [/\bphotorealistic\b/gi,          "accurate surface reflectance, subsurface scatter"],
  [/\bprofessional\s+photography\b/gi, "accurate depth-of-field, precise focus plane"],
  [/\bultra-?realistic\b/gi,        "true surface physics, correct light transport"],

  // ─── Color / appearance — compound forms only ────────────────────────────
  [/\bvibrant\s+colou?rs?\b/gi,     "saturated mid-tones, clean highlight rolloff"],
  [/\bright\s+colou?rs?\b/gi,       "saturated mid-tone, controlled highlight rolloff"],
  [/\bdeep\s+colou?rs?\b/gi,        "shadow detail retained, dark tone separation"],
  [/\bmoody\s+atmosphere\b/gi,      "low-key, shadow-dominant, high contrast ratio"],
];

// ─── Industry physics notes ───────────────────────────────────────────────────
// Brief, physically specific sentences appended to SCENE ATMOSPHERE.
// They always contribute new photographic vocabulary not present in typical
// GPT lightingMood / colorPsychology output — safe against dedup thresholds.
// Never use "luxury", "premium", "beautiful", or any generic adjective.

const INDUSTRY_PHYSICS: Record<SceneIndustry, string> = {
  restaurant:    "Practical: candle-flame 2900K on glassware rims; steam wisps at plate surface; ambient 3200K brass fixtures throughout.",
  dental:        "Clinical: 4500K LED overhead; specular on instrument metal; neutral grey-white surface palette.",
  salon:         "Station: 3000K warm lamp; 5000K overhead fill; wet-hair surface sheen; mirror bounce fill visible.",
  jewellery:     "Optics: 5500K incident source; prismatic light splits at diamond facets; brushed-metal grain micro-sparkle; velvet nap scatter.",
  hospital:      "Clinical: 4500K cool LED; hard specular on sterile surfaces; clean shadow edge on white.",
  interior:      "Light: raking 5500K window source; ceiling diffuse bounce; material grain in directional raking light.",
  "real-estate": "Natural: 5500K indirect window; polished floor reflection; exterior sky at 6500K through glass.",
  furniture:     "Surface: directional raking on upholstery grain; fabric weave texture in specular highlight.",
  school:        "Classroom: 5500K natural overhead; desk-surface grain visible; whiteboard specular highlight present.",
  retail:        "Store: 3000K accent LED on product; 4000K ambient fill; oblique polished-floor reflection.",
  generic:       "Source: controlled directional; accurate surface reflectance; natural shadow gradient.",
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Replace generic visual adjectives in text with physically observable
 * photographic language. Pure, synchronous, deterministic.
 * Apply only to atmosphere fields (lightingMood, colorPsychology, sceneContext).
 * Never apply to heroSubject, primaryAction, or secondarySubjects.
 */
export function applyRealismVocabulary(text: string): string {
  let result = text;
  for (const [pattern, replacement] of SUBSTITUTIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/** Return the industry-specific physical realism note for SCENE ATMOSPHERE. */
export function getIndustryPhysicsNote(industry: SceneIndustry): string {
  return INDUSTRY_PHYSICS[industry];
}
