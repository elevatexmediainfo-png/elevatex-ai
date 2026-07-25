// Phase 8 — Photography Director.
//
// Thinks like a commercial photographer and art director.
// Never writes marketing copy. Only decides:
//   lens · focal length · framing · crop · perspective · camera height
//   lighting · reflections · shadows · texture · atmosphere · motion
//   and — most critically — the decisive commercial moment.
//
// The decisive moment is the single most important output:
// the exact half-second the photograph must capture to be commercially powerful.

import type { GPTCampaignDirection } from "../creative-director/gpt-types";
import type { CreativeStrategy } from "../creative-brain/types";
import type { PhotographyDirectorOutput, DepthOfField, IndustryCategory } from "./types";
import { detectIndustryCategory } from "./design-director";

// ─── Photography specification tables ────────────────────────────────────────

interface PhotoSpec {
  lens:                string;
  focalLength:         string;
  cameraHeight:        string;
  distance:            string;
  framing:             string;
  crop:                string;
  perspective:         string;
  depth:               DepthOfField;
  lightingTemperature: string;
  shadows:             string;
}

const INDUSTRY_PHOTO_SPEC: Record<IndustryCategory, PhotoSpec> = {
  food_hospitality: {
    lens:                "50mm prime",
    focalLength:         "50mm",
    cameraHeight:        "table eye level",
    distance:            "medium close",
    framing:             "diagonal lead — hero dish in golden ratio intersection",
    crop:                "medium portrait, dish to table edge",
    perspective:         "level, never tilted",
    depth:               "shallow",
    lightingTemperature: "3200K warm practical",
    shadows:             "soft natural fill, no hard shadows on food surface",
  },
  jewelry_fashion_luxury: {
    lens:                "100mm macro",
    focalLength:         "100mm",
    cameraHeight:        "product eye level, slight high angle",
    distance:            "close",
    framing:             "centered with deliberate negative space",
    crop:                "tight detail or three-quarter",
    perspective:         "straight or very slight high angle",
    depth:               "shallow",
    lightingTemperature: "5500K neutral to 6000K clean",
    shadows:             "controlled rim shadow, polished surface reflections preserved",
  },
  healthcare_medical: {
    lens:                "50mm prime",
    focalLength:         "50mm",
    cameraHeight:        "standing eye level or slight high",
    distance:            "medium",
    framing:             "left-aligned composition, rule of thirds",
    crop:                "medium portrait",
    perspective:         "level, reassuring — never intimidating low angle",
    depth:               "medium",
    lightingTemperature: "5500K clinical natural",
    shadows:             "minimal — clean, confident, no drama",
  },
  real_estate: {
    lens:                "24mm wide",
    focalLength:         "24mm",
    cameraHeight:        "5-foot tripod height",
    distance:            "wide establishing",
    framing:             "converging lines toward hero space",
    crop:                "full environmental — show the room",
    perspective:         "level, never keystoned",
    depth:               "deep",
    lightingTemperature: "mixed — window daylight with fill",
    shadows:             "controlled — window light with soft interior fill",
  },
  education: {
    lens:                "50mm prime",
    focalLength:         "50mm",
    cameraHeight:        "standing eye level",
    distance:            "medium",
    framing:             "engaged student-teacher interaction",
    crop:                "medium portrait to environmental",
    perspective:         "level, inspiring — slight low for authority",
    depth:               "medium",
    lightingTemperature: "5500K bright natural",
    shadows:             "open, bright — no mood shadows",
  },
  tech_software: {
    lens:                "85mm",
    focalLength:         "85mm portrait",
    cameraHeight:        "product level, slight high angle",
    distance:            "medium close",
    framing:             "centered minimal — product in clean space",
    crop:                "tight product hero or lifestyle",
    perspective:         "straight, clean, no distortion",
    depth:               "shallow",
    lightingTemperature: "6000K clean studio or natural",
    shadows:             "clean studio reflection, no hard falls",
  },
  fitness_wellness: {
    lens:                "35mm",
    focalLength:         "35mm wide-normal",
    cameraHeight:        "low dynamic angle",
    distance:            "medium",
    framing:             "dynamic diagonal — motion or peak action",
    crop:                "full figure or powerful close",
    perspective:         "low angle looking up — power and aspiration",
    depth:               "shallow",
    lightingTemperature: "4500K punchy or golden hour",
    shadows:             "dramatic side shadow allowed — strength and definition",
  },
  beauty_cosmetics: {
    lens:                "85mm portrait",
    focalLength:         "85mm",
    cameraHeight:        "chin level, slight high angle",
    distance:            "close",
    framing:             "centered beauty, symmetry as design",
    crop:                "beauty crop — mid-chest to crown",
    perspective:         "chin level slight high — flattering, aspirational",
    depth:               "shallow",
    lightingTemperature: "5200K warm neutral",
    shadows:             "soft sculpting shadows — define without dramatize",
  },
  financial_services: {
    lens:                "50mm prime",
    focalLength:         "50mm",
    cameraHeight:        "eye level",
    distance:            "medium",
    framing:             "confidence and authority — left-weighted",
    crop:                "medium portrait, professional",
    perspective:         "level, equal — trust and partnership",
    depth:               "medium",
    lightingTemperature: "5000K neutral professional",
    shadows:             "minimal professional fill",
  },
  retail_ecommerce: {
    lens:                "50mm prime",
    focalLength:         "50mm",
    cameraHeight:        "product eye level",
    distance:            "medium close",
    framing:             "product in context of lifestyle",
    crop:                "product hero with lifestyle context",
    perspective:         "level to slight high — inviting",
    depth:               "shallow",
    lightingTemperature: "5500K bright product",
    shadows:             "clean product shadow or lifestyle fill",
  },
  events_entertainment: {
    lens:                "35mm",
    focalLength:         "35mm",
    cameraHeight:        "human eye level, dynamic",
    distance:            "medium wide",
    framing:             "energy and atmosphere — people in the moment",
    crop:                "environmental portrait — place and people",
    perspective:         "level to slight low — celebration and scale",
    depth:               "medium",
    lightingTemperature: "3200K warm ambient or mixed",
    shadows:             "ambient fill — atmosphere drives shadows",
  },
  automotive: {
    lens:                "35mm",
    focalLength:         "35mm",
    cameraHeight:        "low ground level — drama and road presence",
    distance:            "medium wide",
    framing:             "three-quarter front — presence and motion",
    crop:                "full vehicle in environment",
    perspective:         "low angle — authority, power, desire",
    depth:               "deep",
    lightingTemperature: "3200K golden hour or 5600K studio",
    shadows:             "long dramatic shadows — motion and power",
  },
  general: {
    lens:                "50mm prime",
    focalLength:         "50mm",
    cameraHeight:        "eye level",
    distance:            "medium",
    framing:             "rule of thirds",
    crop:                "medium portrait",
    perspective:         "level",
    depth:               "medium",
    lightingTemperature: "5000K neutral",
    shadows:             "open fill",
  },
};

// ─── Industry-specific motion, texture, reflection, backlight ─────────────────

const INDUSTRY_MOTION: Record<IndustryCategory, string> = {
  food_hospitality:       "garnish falling, liquid pour, steam rising — freeze at peak",
  jewelry_fashion_luxury: "fabric catching light mid-drape, clasp meeting at the decisive instant",
  healthcare_medical:     "gentle consultation gesture frozen — no sharp clinical motion",
  real_estate:            "stillness preferred — light movement through curtains only",
  education:              "hands-on engagement caught mid-action, genuine expression",
  tech_software:          "finger hovering above screen, interface interaction captured",
  fitness_wellness:       "peak of exertion — jump at apex, muscle in full contraction",
  beauty_cosmetics:       "product drop settling, brush mid-stroke, natural expression",
  financial_services:     "confident handshake or document signing",
  retail_ecommerce:       "hands engaging product — tactile, deliberate",
  events_entertainment:   "genuine reaction caught — laughter, celebration, connection",
  automotive:             "wheel at precise angle, no motion blur unless intentional",
  general:                "natural decisive action mid-movement",
};

const INDUSTRY_TEXTURE: Record<IndustryCategory, string> = {
  food_hospitality:       "food surface texture — crisp, glistening, perfectly plated",
  jewelry_fashion_luxury: "gemstone facets, metal polish, fabric grain",
  healthcare_medical:     "clinical precision — clean gloves, polished instruments",
  real_estate:            "material surfaces — marble, wood grain, textured walls",
  education:              "paper, book texture, engaged human expression",
  tech_software:          "product material finish, screen clarity, surface quality",
  fitness_wellness:       "skin detail, equipment texture, sweat realism",
  beauty_cosmetics:       "skin pore detail, product formula texture, packaging surface",
  financial_services:     "high-quality paper, polished desk surface, professional detail",
  retail_ecommerce:       "product material quality — stitching, finish, detail",
  events_entertainment:   "sparkle, decoration texture, genuine fabric and decor",
  automotive:             "paint depth, chrome reflection, tyre sidewall, interior material",
  general:                "contextual texture — whatever the hero subject demands",
};

const INDUSTRY_REFLECTION: Record<IndustryCategory, string> = {
  food_hospitality:       "polished glassware and cutlery catching warm chandelier light",
  jewelry_fashion_luxury: "gemstone reflections, metal glint, mirror surface",
  healthcare_medical:     "minimal — clean instrument steel only",
  real_estate:            "window glass, polished floors, chrome fixtures",
  education:              "minimal, clean",
  tech_software:          "screen light, product surface reflection",
  fitness_wellness:       "gym mirror, equipment chrome, natural window",
  beauty_cosmetics:       "product packaging gloss, mirror reflection",
  financial_services:     "glass table, polished desk surface",
  retail_ecommerce:       "product surface sheen",
  events_entertainment:   "glasses, décor sparkle, chandelier reflection",
  automotive:             "paint depth, chrome, wet road reflection",
  general:                "contextual surface reflections",
};

const INDUSTRY_BACKLIGHT: Record<IndustryCategory, string> = {
  food_hospitality:       "steam as natural backlight behind the hero dish",
  jewelry_fashion_luxury: "rim lighting creating halo on metal edges",
  healthcare_medical:     "clean window backlight, no dramatic halo",
  real_estate:            "window light as natural backlight",
  education:              "window or soft fill light",
  tech_software:          "screen glow or soft window",
  fitness_wellness:       "window backlight or studio rim",
  beauty_cosmetics:       "soft diffused rim light on hair",
  financial_services:     "window light, natural dignity",
  retail_ecommerce:       "product rim light or window",
  events_entertainment:   "ambient event light, warm practical",
  automotive:             "sunset rim light or studio sweep",
  general:                "natural rim or window backlight",
};

const INDUSTRY_ATMOSPHERE: Record<IndustryCategory, string> = {
  food_hospitality:       "the deliberate calm of a premium restaurant twenty minutes before the evening rush",
  jewelry_fashion_luxury: "the quiet moment of possession and aspiration — exclusivity as atmosphere",
  healthcare_medical:     "a calm, competent environment where the patient is already reassured",
  real_estate:            "the first morning in a home that already feels like yours",
  education:              "the focused energy of a room where futures are being shaped",
  tech_software:          "clean, purposeful, modern — the place where the future is designed",
  fitness_wellness:       "the exact second where effort becomes achievement — earned, not posed",
  beauty_cosmetics:       "the private ritual of becoming — intimate, aspirational, real",
  financial_services:     "the quiet confidence of a room where important decisions are made clearly",
  retail_ecommerce:       "the tactile pleasure of owning something made with exceptional care",
  events_entertainment:   "the peak of genuine celebration — not staged, not rehearsed",
  automotive:             "the road as the only destination that matters — freedom, performance, desire",
  general:                "an atmosphere that makes the viewer feel the campaign before they read it",
};

// ─── Decisive moment builder ──────────────────────────────────────────────────

function firstSentence(text: string): string {
  if (!text?.trim()) return "";
  const m = text.trim().match(/^.+?[.!?](?!\d)/);
  return m ? m[0].trim() : text.trim().split("\n")[0].trim();
}

function extractHeroClause(heroSubject: string): string {
  if (!heroSubject?.trim()) return "";
  return heroSubject
    .trim()
    .replace(/^(a |an |the )/i, "")
    .split(/[,—\-\n]/)[0]
    .trim()
    .replace(/[.!?]+$/, "");  // strip trailing punctuation so callers can append their own
}

function buildDecisiveMoment(
  dir: GPTCampaignDirection,
  industry: IndustryCategory,
): string {
  const hero    = extractHeroClause(dir.heroSubject ?? "");
  const moment  = firstSentence(dir.visualStory?.moment ?? "");
  const lighting = firstSentence(dir.lightingMood ?? "");
  const motion  = INDUSTRY_MOTION[industry];

  const parts: string[] = [];

  if (hero && moment) {
    // Core decisive moment construction
    parts.push(
      `${hero.charAt(0).toUpperCase()}${hero.slice(1)} is captured at the precise instant ${
        moment.charAt(0).toLowerCase()
      }${moment.slice(1).replace(/\.$/, "")}`
    );
  } else if (hero) {
    parts.push(`${hero.charAt(0).toUpperCase()}${hero.slice(1)} is held frozen at a single deliberate moment`);
  } else if (moment) {
    parts.push(`The scene is locked at the precise instant ${moment.charAt(0).toLowerCase()}${moment.slice(1).replace(/\.$/, "")}`);
  }

  // Add lighting interaction
  if (lighting) {
    const lightClause = firstSentence(lighting).replace(/\.$/, "").toLowerCase();
    parts.push(`while ${lightClause}`);
  }

  // Add industry-specific motion precision
  parts.push(motion);

  const core = parts.filter(Boolean).join(", ") + ".";

  return core;
}

// ─── Main function ────────────────────────────────────────────────────────────

export function buildPhotographyDirectorOutput(
  dir: GPTCampaignDirection,
  strategy: CreativeStrategy,
  aspectRatio: "9:16" | "1:1" | "16:9" = "9:16",
): PhotographyDirectorOutput {
  const industry = detectIndustryCategory(strategy.business.industry.value ?? "");
  const spec     = INDUSTRY_PHOTO_SPEC[industry];

  // Aspect ratio adjusts framing and crop
  let framing = spec.framing;
  let crop    = spec.crop;
  let depth: DepthOfField = spec.depth;
  if (aspectRatio === "16:9") {
    framing = `horizontal ${framing} — landscape composition`;
    crop    = `wide crop, ${crop}`;
  } else if (aspectRatio === "1:1") {
    framing = `square composition — ${framing}`;
    crop    = `square crop, ${crop}`;
  }

  // Fix 3b — photographyStyle from Creative Brain (especially when reference-image-derived)
  // takes priority over the industry-table defaults for the fields it directly governs.
  // Industry table is the baseline; Creative Brain overrides only the relevant spec fields
  // so photography intent from user-uploaded references is preserved end-to-end.
  const photoStyle      = strategy.visual.photographyStyle;
  const photoStyleValue = photoStyle.value;
  const photoStyleHasPriority =
    photoStyleValue !== "none" &&
    photoStyleValue !== "unknown" &&
    (photoStyle.confidence === "high" || photoStyle.confidence === "medium");

  if (photoStyleHasPriority) {
    if (photoStyleValue === "before_after") {
      framing = "split panel — before state (left) and after state (right), clear visual division between the two states";
      crop    = "wide comparison frame, both states fully visible within a single frame";
    } else if (photoStyleValue === "macro_detail") {
      depth = "shallow";
    } else if (photoStyleValue === "lifestyle" || photoStyleValue === "editorial") {
      depth = "shallow";
    } else if (photoStyleValue === "documentary") {
      depth = "deep";
    }
  }

  // Derive lighting from GPT direction's lightingMood if available
  const lighting = dir.lightingMood?.trim()
    ? firstSentence(dir.lightingMood)
    : `${spec.lightingTemperature} primary light with soft environmental fill`;

  // Focus point from GPT direction
  const focus = dir.visualHierarchy?.primary
    ? extractHeroClause(dir.visualHierarchy.primary)
    : dir.heroSubject
      ? extractHeroClause(dir.heroSubject)
      : "hero subject";

  return {
    lens:                spec.lens,
    focalLength:         spec.focalLength,
    cameraHeight:        spec.cameraHeight,
    distance:            spec.distance,
    framing,
    crop,
    perspective:         spec.perspective,
    focus,
    depth,
    lighting,
    lightingTemperature: spec.lightingTemperature,
    backlight:           INDUSTRY_BACKLIGHT[industry],
    reflection:          INDUSTRY_REFLECTION[industry],
    shadows:             spec.shadows,
    motion:              INDUSTRY_MOTION[industry],
    texture:             INDUSTRY_TEXTURE[industry],
    atmosphere:          INDUSTRY_ATMOSPHERE[industry],
    decisiveMoment:      buildDecisiveMoment(dir, industry),
  };
}
