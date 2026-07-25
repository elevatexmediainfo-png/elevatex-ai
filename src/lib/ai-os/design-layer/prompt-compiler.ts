// Phase 8.4 — Prompt Compiler V3: Commercial System Specification.
//
// Behaves like an Executive Creative Director + Production System delivering
// structured execution instructions to Midjourney, GPT Image, Imagen 4,
// Flux, Seedream, and Ideogram.
//
// Output structure:
//   PRIORITY RULES          — 8-level conflict resolution hierarchy
//   EXECUTION DIRECTIVE     — behavioral mandate (reason before generating)
//    1. Executive Vision    — campaign purpose, emotional outcome, commercial goal
//    2. Visual Hierarchy    — P1–P5 with %, spatial positions, measurement targets
//    3. Composition Blueprint — exact element positions with spatial coordinates
//    4. Photography Direction — full commercial shoot specification + quality bar
//    5. Subject Direction   — decisive moment, human behaviour mandate + quality bar
//    6. Environment Direction — 6-layer visual breakdown + quality bar
//    7. Typography Direction — hierarchy with frame % measurements + quality bar
//    8. Layout Direction    — region specs with measurement mandate + quality bar
//    9. Commercial Details  — trust signals, must-include, psychological triggers
//   10. Industry Reference  — brand benchmarks for this specific industry
//   11. Quality Requirements — non-negotiable mandate + hard constraints
//   SELF-REVIEW CHECKLIST   — 11 mandatory pre-generation checks
//
// No LLM. No I/O. Pure function.
// Input:  all four DirectorOutput types + GPTCampaignDirection + optional industry
// Output: string — production-ready commercial system specification

import type { GPTCampaignDirection } from "../creative-director/gpt-types";
import type {
  DesignDirectorOutput,
  PhotographyDirectorOutput,
  TypographyDirectorOutput,
  LayoutDirectorOutput,
  IndustryCategory,
} from "./types";
import { detectIndustryCategory } from "./design-director";

// ─── Industry Reference Library ───────────────────────────────────────────────
// Per-industry visual benchmark brands and style descriptions.
// Used in S10 to specify the quality register the image must match.

interface IndustryRef {
  brands: string[];
  style:  string;
}

const INDUSTRY_REF: Record<IndustryCategory, IndustryRef> = {
  food_hospitality: {
    brands: ["Taj Hotels", "Indian Accent", "Masque Mumbai", "The Oberoi", "ITC Hotels"],
    style:  "Michelin-grade editorial food photography. Warm amber atmosphere. Premium Indian hospitality visual language.",
  },
  jewelry_fashion_luxury: {
    brands: ["Tanishq", "Kalyan Jewellers", "Malabar Gold", "Cartier", "Bvlgari"],
    style:  "Ultra-premium Indian jewellery editorial. Intimate directional lighting. Indian bridal and festive luxury aesthetic.",
  },
  healthcare_medical: {
    brands: ["Apollo Hospitals", "Fortis Healthcare", "Max Healthcare", "Apollo Dental", "Clove Dental", "Sabka Dentist"],
    style:  "Premium clinical trust photography. Clean, warm, and reassuring. No sterile cold hospital aesthetic. Scandinavian medical advertising warmth.",
  },
  real_estate: {
    brands: ["Lodha", "DLF", "Godrej Properties", "Sobha", "Prestige Group", "Architectural Digest India"],
    style:  "Premium Indian aspirational residential lifestyle photography. Architectural Digest India editorial quality.",
  },
  education: {
    brands: ["IIMs", "ISB Hyderabad", "BITS Pilani", "Allen Career Institute", "Vedantu premium"],
    style:  "Aspirational Indian academic photography. Achievement energy. Family pride and generational ambition narrative.",
  },
  tech_software: {
    brands: ["Infosys brand campaigns", "Freshworks", "Zoho premium", "Apple India"],
    style:  "Clean premium product photography. Minimal editorial. Modern Indian tech professional context.",
  },
  fitness_wellness: {
    brands: ["Cult.fit", "Nike India", "Gold's Gym India", "Lululemon India"],
    style:  "High-energy premium performance photography. Dynamic motion. Aspirational Indian fitness aesthetic.",
  },
  beauty_cosmetics: {
    brands: ["Nykaa", "Lakmé", "Forest Essentials", "Kama Ayurveda", "Elle India editorial"],
    style:  "Premium Indian beauty editorial. Warm Indian skin tones. Fashion magazine production quality.",
  },
  financial_services: {
    brands: ["HDFC Bank premium campaigns", "Kotak Mahindra", "Bajaj Finserv", "SBI Life", "Tata AIA"],
    style:  "Authority trust photography. Premium professional Indian environment. Aspirational financial milestone.",
  },
  retail_ecommerce: {
    brands: ["Raymond", "Fabindia premium", "Myntra premium editorial", "Tanishq retail"],
    style:  "Premium Indian lifestyle retail photography. Product-in-context editorial quality.",
  },
  events_entertainment: {
    brands: ["Taj Weddings", "The Leela Events", "BookMyShow premium", "Sunburn Festival"],
    style:  "Premium Indian experiential photography. Genuine celebratory moments. Rich warm ambient lighting.",
  },
  automotive: {
    brands: ["Royal Enfield premium", "Tata Motors brand campaigns", "BMW India", "Mercedes-Benz India", "Maruti Nexa"],
    style:  "Premium automotive photography. Golden hour or studio sweep. Performance and aspiration narrative.",
  },
  general: {
    brands: ["Tata brand campaigns", "Asian Paints premium", "Tanishq", "Royal Enfield"],
    style:  "Premium Indian commercial photography. Category-leading visual quality.",
  },
};

// ─── Static preamble and checklist ───────────────────────────────────────────

const PRIORITY_RULES = `PRIORITY RULES
When two instructions conflict, resolve using this hierarchy. Never sacrifice a higher-priority objective for a lower one.
1. Commercial communication — the image must first communicate the business message
2. Visual hierarchy — the viewer's eye must follow the intended path without confusion
3. Human emotion — the emotional response must be immediate and unmistakable
4. Product visibility — the hero subject must be identifiable within 2 seconds
5. Typography placement — headline, CTA, and logo zones are pre-reserved and inviolable
6. Composition — rule of thirds, golden ratio, and diagonal tension
7. Environment styling — background supports the story but never competes with hero
8. Decorative elements — texture, bokeh, and props are lowest priority
Conflict example: If a decorative background element competes with the hero for attention — remove or blur the background element. Commercial communication always wins.`;

const EXECUTION_DIRECTIVE = `EXECUTION DIRECTIVE
Study all sections completely before generating. Identify any conflict between sections. Apply priority rules above to resolve. Do not expose your reasoning in the final image. Generate only the finished commercial image that satisfies all non-conflicting instructions.`;

const SELF_REVIEW_CHECKLIST = `SELF-REVIEW CHECKLIST
Before generating, verify every item is YES. If any answer is NO — revise the generation plan internally and return only the improved version. Never expose the checklist or revision process.
✓ Hero is immediately identifiable — no ambiguity about the primary focal subject within 2 seconds
✓ Eye flow is obvious — viewer's gaze travels a clear path from hero to headline zone to CTA
✓ Human action is believable — no one is posing, no one is looking at camera, every person is mid-action
✓ Typography hierarchy is defined — headline dominates, CTA contrasts, logo is the quietest element
✓ CTA placement is clear — not obscured by hero subject or any environmental element
✓ Layout is balanced — no quadrant is visually empty or overcrowded
✓ Visual layers are present — foreground, midground, and background are visually distinct
✓ Lighting supports the emotion — color temperature and directionality reinforce the campaign feeling
✓ Environment supports the story — every visible object earns its narrative place
✓ Indian authenticity is preserved — Indian faces, Indian interiors, Indian cultural context
✓ Commercial quality achieved — indistinguishable from a paid production shoot at ₹5 lakh+ budget`;

// ─── Shared helpers ───────────────────────────────────────────────────────────

function sentence(s: string | undefined | null): string {
  const t = (s ?? "").trim();
  if (!t) return "";
  return t.endsWith(".") || t.endsWith("!") || t.endsWith("?") ? t : `${t}.`;
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// First complete sentence — ends at . ! ? Avoids splitting on decimals.
function firstSentence(text: string): string {
  if (!text?.trim()) return "";
  const m = text.trim().match(/^.+?[.!?](?!\d)/);
  return m ? m[0].trim() : text.trim().split("\n")[0].trim();
}

// First clause — everything before an em-dash elaboration.
function firstClause(s: string): string {
  const t = s.trim();
  if (!t) return "";
  const idx = t.indexOf(" — ");
  if (idx > 20) return t.slice(0, idx).trim();
  return firstSentence(t) || t.split(/[,\-\n]/)[0].trim();
}

// ─── S1: Executive Vision ─────────────────────────────────────────────────────
// Campaign purpose + emotional outcome + commercial goal.
// NOT a marketing story — a production mandate for the image model.

function buildS1(dir: GPTCampaignDirection): string {
  const vision: string[] = [];

  if (dir.campaignConcept?.trim())    vision.push(sentence(cap(dir.campaignConcept)));
  if (dir.marketingObjective?.trim()) vision.push(sentence(cap(dir.marketingObjective)));
  if (dir.viewerEmotion?.trim()) {
    const emotion = dir.viewerEmotion.trim().toLowerCase().replace(/[.!?]+$/, "");
    vision.push(`The viewer must immediately feel: ${emotion}.`);
  }
  if (dir.coreMessage?.trim())        vision.push(`Single takeaway: ${sentence(cap(dir.coreMessage))}`);
  if (dir.psychologicalGoal?.trim())  vision.push(sentence(cap(dir.psychologicalGoal)));

  vision.push(
    `NOT: "Show a beautiful premium scene." — ` +
    `REQUIRED: "Create immediate desire, FOMO, or trust that converts the viewer into a customer before they scroll past."`
  );

  return `1. EXECUTIVE VISION\n${vision.filter(Boolean).join(" ")}`;
}

// ─── S2: Visual Hierarchy ────────────────────────────────────────────────────
// P1–P5 with visual weight %, spatial positions, and measurement targets.
// Never leaves importance ambiguous — always defines visual dominance explicitly.

function buildS2(dir: GPTCampaignDirection, design: DesignDirectorOutput): string {
  const p1Desc = dir.heroSubject?.trim()
    ? firstClause(dir.heroSubject)
    : "Primary visual subject";

  const p2Desc = dir.visualHierarchy?.secondary?.trim()
    ? firstClause(dir.visualHierarchy.secondary)
    : dir.secondarySubjects?.trim()
      ? firstClause(dir.secondarySubjects)
      : "Human interaction and secondary subjects";

  const p3Desc = dir.supportingObjects?.trim()
    ? firstClause(dir.supportingObjects)
    : "Supporting objects and product details";

  const p4Desc = dir.visualHierarchy?.background?.trim()
    ? firstClause(dir.visualHierarchy.background)
    : dir.environment?.trim()
      ? firstClause(dir.environment)
      : "Environmental atmosphere and ambient setting";

  // Visual weight distribution — heroWeight comes from Design Director
  const p1 = design.heroWeight;
  const remaining = 100 - p1 - design.logoWeight;
  const p2 = Math.round(remaining * 0.44);
  const p3 = Math.round(remaining * 0.28);
  const p4 = Math.round(remaining * 0.17);
  const p5 = 100 - p1 - p2 - p3 - p4;

  return [
    "2. VISUAL HIERARCHY",
    `P1 Hero (${p1}%) — GOLDEN RATIO CENTER\n${sentence(p1Desc)}`,
    `P2 Human Interaction (${p2}%) — REAR THIRDS (left or right of hero)\n${sentence(p2Desc)}`,
    `P3 Supporting Detail (${p3}%) — FOREGROUND or MID-FRAME (contextual placement)\n${sentence(p3Desc)}`,
    `P4 Environment (${p4}%) — FULL FRAME WRAP (atmospheric depth, receding)\n${sentence(p4Desc)}`,
    `P5 Branding Zone (${p5}%) — TOP RESERVED ZONE + LOWER SAFE ZONE\nLogo, CTA button, and contact details. Pre-reserved. No hero intrusion permitted.`,
    `Measurement targets: Hero zone 40–55% of frame height. Typography zone 18–22% of frame height. CTA 8–12% of frame height. Logo 3–5% of frame height. Minimum whitespace between any two zones: 7%.`,
    `NOT: "Hero is the main focus." — REQUIRED: "Hero occupies ${p1}% of visual weight at golden ratio center. P2–P5 are consciously, measurably smaller. No two elements share equal visual weight."`,
  ].join("\n");
}

// ─── S3: Composition Blueprint ────────────────────────────────────────────────
// Exact element positions with spatial coordinates — top-left, upper-third,
// golden-ratio, center, lower safe zone, rear-left, rear-right.
// Every object has a named position. Nothing is placed by accident.

function buildS3(
  dir: GPTCampaignDirection,
  design: DesignDirectorOutput,
  layout: LayoutDirectorOutput,
): string {
  const lines = ["3. COMPOSITION BLUEPRINT"];

  // Headline — always upper zone
  if (dir.negativeSpace?.headline?.trim()) {
    lines.push(`Headline: UPPER ZONE — ${sentence(cap(dir.negativeSpace.headline))}`);
  } else {
    lines.push(`Headline: UPPER ZONE — ${layout.regions.headline.zone}. Top ${layout.safeMargins.top} strictly reserved. No visual competition from hero below.`);
  }

  // Hero — golden ratio center
  lines.push(`Hero subject: GOLDEN RATIO CENTER — ${layout.regions.hero.zone}. Commands the composition. No element overlaps or competes within this zone.`);

  // Secondary subject — rear thirds
  if (dir.secondarySubjects?.trim()) {
    lines.push(`Secondary subject: REAR-LEFT or REAR-RIGHT THIRD — behind and beside hero. Contextual, never competing.`);
  }

  // Supporting objects — foreground
  if (dir.supportingObjects?.trim()) {
    lines.push(`Supporting objects: FOREGROUND (closest to camera lens) — tactile, detailed, adds environmental authenticity.`);
  }

  // CTA — lower safe zone
  if (dir.negativeSpace?.cta?.trim()) {
    lines.push(`CTA: LOWER SAFE ZONE — ${sentence(cap(dir.negativeSpace.cta))}`);
  } else {
    lines.push(`CTA: LOWER SAFE ZONE — ${layout.regions.cta.zone}. Maximum visual prominence. Completely unobstructed.`);
  }

  // Logo — lower-right corner
  if (dir.negativeSpace?.logo?.trim()) {
    lines.push(`Logo: LOWER-RIGHT CORNER — ${sentence(cap(dir.negativeSpace.logo))}`);
  } else {
    lines.push(`Logo: LOWER-RIGHT CORNER — ${layout.regions.logo.zone}. Confident positioning, never competing with hero or CTA.`);
  }

  // Safe margins
  const m = layout.safeMargins;
  lines.push(
    `Safe margins: Top ${m.top} | Bottom ${m.bottom} | Left ${m.left} | Right ${m.right}. ` +
    `No important element touches any frame edge. These zones are pre-reserved.`
  );

  // Reading flow
  if (design.readingFlow.length >= 2) {
    lines.push(`Reading flow: ${design.readingFlow.join(" → ")}.`);
  }

  if (dir.compositionIntent?.eyeFlow?.trim())
    lines.push(`Eye flow: ${sentence(dir.compositionIntent.eyeFlow)}`);
  if (dir.compositionIntent?.subjectBalance?.trim())
    lines.push(`Balance: ${sentence(dir.compositionIntent.subjectBalance)}`);
  if (dir.compositionIntent?.framingLogic?.trim())
    lines.push(`Framing logic: ${sentence(dir.compositionIntent.framingLogic)}`);

  if (layout.visualRhythm?.trim()) lines.push(sentence(cap(layout.visualRhythm)));

  lines.push(
    `NOT: "Good composition. Balanced layout." — ` +
    `REQUIRED: "Every element has an explicit spatial coordinate. ` +
    `Headline at upper-third. Hero at golden-ratio center. Secondary at rear-right third. ` +
    `Supporting objects in foreground. CTA at lower safe zone. Logo at lower-right corner."`
  );

  return lines.join("\n");
}

// ─── S4: Photography Direction ────────────────────────────────────────────────
// Full commercial shoot specification — lens, height, distance, light, shadow.
// Every field is a production-ready instruction, not a creative suggestion.

function buildS4(photo: PhotographyDirectorOutput): string {
  const lines = ["4. PHOTOGRAPHY DIRECTION"];

  lines.push(`Lens: ${photo.lens} at ${photo.focalLength}.`);
  lines.push(`Camera height: ${photo.cameraHeight}.`);
  lines.push(`Shooting distance: ${photo.distance}.`);
  lines.push(`Perspective: ${photo.perspective}.`);
  lines.push(`Framing: ${photo.framing}.`);
  lines.push(`Crop: ${photo.crop}.`);
  lines.push(`Focus: Locked on ${photo.focus}. Depth of field: ${photo.depth}.`);
  lines.push(`Lighting: ${sentence(cap(photo.lighting))}`);
  lines.push(`Lighting temperature: ${photo.lightingTemperature}.`);
  if (photo.backlight?.trim())  lines.push(`Backlight: ${sentence(photo.backlight)}`);
  if (photo.reflection?.trim()) lines.push(`Reflections: ${sentence(photo.reflection)}`);
  lines.push(`Shadows: ${sentence(photo.shadows)}`);

  lines.push(
    `NOT: "Warm lighting. Good exposure." — ` +
    `REQUIRED: "Soft warm directional window light from camera-left at 45°. ` +
    `Practical ambient chandeliers at 3200K as secondary fill. ` +
    `Natural shadow falloff on all surfaces. No flat or even illumination. ` +
    `Hero subject is always the brightest and sharpest element in the frame."`
  );

  return lines.join("\n");
}

// ─── S5: Subject Direction — Human Behaviour ─────────────────────────────────
// Decisive moment is the anchor. Every human is mid-action. No poses. No camera eye.

function buildS5(dir: GPTCampaignDirection, photo: PhotographyDirectorOutput): string {
  const lines = ["5. SUBJECT DIRECTION — HUMAN BEHAVIOUR"];

  // Decisive moment is the single most important subject instruction
  if (photo.decisiveMoment?.trim()) {
    lines.push(`Decisive moment: ${sentence(cap(photo.decisiveMoment))}`);
  }

  if (dir.heroSubject?.trim()) {
    lines.push(`Primary subject: ${sentence(cap(dir.heroSubject))}`);
  }

  if (dir.visualStory?.moment?.trim()) {
    lines.push(`Story beat: ${sentence(cap(dir.visualStory.moment))}`);
  }

  if (dir.secondarySubjects?.trim()) {
    lines.push(`Secondary subject: ${sentence(cap(dir.secondarySubjects))}`);
  }

  if (photo.motion?.trim()) {
    lines.push(`Motion specification: ${sentence(cap(photo.motion))}`);
  }

  if (dir.microInteractions?.length) {
    const micro = dir.microInteractions.map(m => sentence(cap(m)));
    lines.push(`Micro details: ${micro.join(" ")}`);
  }

  lines.push(
    "HUMAN BEHAVIOUR MANDATE: " +
    "Every human is actively doing something specific and decisive. " +
    "No one looks at camera under any circumstances. " +
    "No posed positions or static standing. " +
    "No smiling at nothing. " +
    "No freeze-frame neutrality. " +
    "Every person is caught in a half-second action that exists in real life."
  );

  lines.push(
    `NOT: "Happy chef. Smiling couple. Luxury restaurant ambience." — ` +
    `REQUIRED: "Indian head chef placing final microgreen garnish with tweezers at the decisive instant. ` +
    `Indian couple mid-turn noticing the dish aroma — they have not yet looked at it. ` +
    `Steam rising from the plate catching the chandelier backlight. ` +
    `No eye contact with camera from any subject in the frame."`
  );

  return lines.join("\n");
}

// ─── S6: Environment Direction — Visual Layers ────────────────────────────────
// Scene divided into 6 distinct layers. Every layer described separately.
// No generic blur. No random props. Every element earns its narrative place.

function buildS6(dir: GPTCampaignDirection, photo: PhotographyDirectorOutput): string {
  const lines = ["6. ENVIRONMENT DIRECTION — VISUAL LAYERS"];

  lines.push("SCENE LAYERING — Describe and render every layer separately:");

  // FOREGROUND
  if (dir.supportingObjects?.trim()) {
    lines.push(`  FOREGROUND: ${sentence(cap(firstClause(dir.supportingObjects)))} Closest to camera lens — tactile, detailed, high surface texture.`);
  } else {
    lines.push(`  FOREGROUND: Scene-appropriate objects at table or ground level. Tactile surface detail in sharpest foreground.`);
  }

  // MIDGROUND — HERO
  if (dir.heroSubject?.trim()) {
    lines.push(`  MIDGROUND (HERO): ${sentence(cap(firstClause(dir.heroSubject)))} Maximum visual real estate, sharpest focus in the entire frame.`);
  } else {
    lines.push(`  MIDGROUND (HERO): Primary subject at maximum focus. Commands the most visual weight in the scene.`);
  }

  // SECONDARY
  if (dir.secondarySubjects?.trim()) {
    lines.push(`  SECONDARY: ${sentence(cap(firstClause(dir.secondarySubjects)))} Supports hero without competing. Slightly softer than hero.`);
  } else {
    lines.push(`  SECONDARY: Supporting subjects in rear thirds. Contextual and clearly subordinate to hero.`);
  }

  // BACKGROUND
  if (dir.visualHierarchy?.background?.trim()) {
    lines.push(`  BACKGROUND: ${sentence(cap(firstClause(dir.visualHierarchy.background)))} Environmental context. Recognizable industry setting. No generic empty blur.`);
  } else if (dir.environment?.trim()) {
    lines.push(`  BACKGROUND: ${sentence(cap(firstClause(dir.environment)))} Environmental context and brand atmosphere.`);
  } else {
    lines.push(`  BACKGROUND: Recognizable, specific environment. Industry-appropriate. Not generic blur.`);
  }

  // FAR BACKGROUND
  if (photo.atmosphere?.trim()) {
    lines.push(`  FAR BACKGROUND: ${sentence(cap(firstSentence(photo.atmosphere)))} Depth cues and atmospheric mood only — no sharp competing detail.`);
  } else {
    lines.push(`  FAR BACKGROUND: Atmospheric depth and spatial scale. Receding bokeh. Mood only — no sharp detail here.`);
  }

  // Color, scene details, and texture
  if (dir.colorPsychology?.trim())
    lines.push(`Color direction: ${sentence(dir.colorPsychology.trim().toLowerCase())}`);

  if (dir.sceneDescription?.trim())
    lines.push(sentence(cap(firstSentence(dir.sceneDescription))));

  if (dir.visualHierarchy?.decorative?.trim())
    lines.push(`Decorative layer: ${sentence(cap(dir.visualHierarchy.decorative))}`);

  if (photo.texture?.trim())
    lines.push(`Texture mandate: ${sentence(cap(photo.texture))}`);

  if (photo.reflection?.trim())
    lines.push(`Reflective surfaces: ${sentence(cap(photo.reflection))}`);

  lines.push("MANDATORY: Every background element earns its narrative place. No empty decorative blur. No random props. Every visible object communicates trust, quality, or emotion.");

  lines.push(
    `NOT: "Restaurant background. Nice decor." — ` +
    `REQUIRED: "Dark walnut walls with brass inlay details. Ambient chandelier wash at 3200K. ` +
    `Handmade ceramic tableware with visible glaze texture. Fine linen napkins pressed flat. ` +
    `Steam from hero dish rising into chandelier backlight in far background layer."`
  );

  return lines.join("\n");
}

// ─── S7: Typography Direction ─────────────────────────────────────────────────
// Hierarchy without font names. % measurements for every text element.
// Hierarchy must be immediately obvious — never equal weight between any elements.

function buildS7(typography: TypographyDirectorOutput): string {
  const lines = ["7. TYPOGRAPHY DIRECTION"];

  lines.push(`Headline: Dominance ${typography.headline.dominance}/10. ${sentence(typography.headline.personality)}`);
  lines.push(`Headline width: ${typography.headline.width}. Maximum ${typography.headline.maxLines} lines. Alignment: ${typography.headline.alignment}.`);
  lines.push(`Headline frame measurement: 18–22% of frame height. Single largest text element — always dominant.`);
  lines.push(`Headline safe zone: ${sentence(typography.headline.safeZone)}`);

  lines.push(`CTA: Dominance ${typography.cta.dominance}/10. Size: ${typography.cta.size}. Contrast: ${typography.cta.contrast} against the image.`);
  lines.push(`CTA frame measurement: 8–12% of frame height. Highest contrast element after the headline.`);
  lines.push(`CTA placement: ${sentence(typography.cta.position)}`);
  lines.push(`CTA safe zone: ${sentence(typography.cta.safeZone)}`);

  lines.push(`Logo: Visibility — ${typography.logo.visibility}. Frame measurement: 3–5% of frame height.`);
  lines.push(`Logo placement: ${sentence(typography.logo.position)}`);
  lines.push(`Logo rule: Always the most restrained element. Never competes with headline or CTA.`);

  lines.push(`Typography personality: ${sentence(typography.typographyPersonality)}`);
  lines.push(`Spacing: ${sentence(typography.spacingBehavior)}`);

  lines.push("Hierarchy rule: Never equal text weight between any two elements. Hierarchy must be obvious within 1 second of viewing.");

  lines.push(
    `NOT: "Luxury typography. Premium look. Clean fonts." — ` +
    `REQUIRED: "Headline at upper 20% of frame — visually dominant, largest element. ` +
    `Subheadline 40% of headline's visual weight. CTA at lower safe zone — maximum contrast. ` +
    `Logo quietest element at 3–5% of frame height — never competing."`
  );

  return lines.join("\n");
}

// ─── S8: Layout Direction ─────────────────────────────────────────────────────
// Production-ready region specs with explicit measurement mandate.
// Every zone has a defined purpose and size target.

function buildS8(layout: LayoutDirectorOutput, design: DesignDirectorOutput): string {
  const lines = ["8. LAYOUT DIRECTION"];

  const r = layout.regions;
  lines.push(`Headline region: ${r.headline.zone}. Reserved for: ${r.headline.contents.join(", ")}.`);
  lines.push(`Hero region: ${r.hero.zone}. Contains: ${r.hero.contents.join(", ")}.`);
  lines.push(`CTA region: ${r.cta.zone}. Reserved for: ${r.cta.contents.join(", ")}.`);
  lines.push(`Footer / Logo: ${r.footer.zone}. Contains: ${r.footer.contents.join(", ")}.`);

  const m = layout.safeMargins;
  lines.push(`Margins: Top ${m.top} | Bottom ${m.bottom} | Left ${m.left} | Right ${m.right}.`);

  lines.push(
    "MEASUREMENT MANDATE: " +
    "Headline zone 18–22% of frame height | " +
    "Hero zone 40–55% of frame height | " +
    "CTA zone 8–12% of frame height | " +
    "Logo 3–5% of frame height | " +
    "Outer margins minimum 8% on all four sides | " +
    "Minimum whitespace between any two zones 7% | " +
    "Foreground depth layer 10% of frame."
  );

  if (layout.alignmentGuide?.trim()) lines.push(sentence(cap(layout.alignmentGuide)));
  if (layout.visualRhythm?.trim())   lines.push(sentence(cap(layout.visualRhythm)));

  lines.push(`Grid: ${design.grid}. Balance: ${design.balance}. Density: ${design.designDensity}.`);

  lines.push("Rule: Respect mobile-safe margins. No element within 5% of any frame edge. Generous whitespace is the primary luxury signal — not decoration.");

  lines.push(
    `NOT: "Good spacing. Balanced layout. Looks clean." — ` +
    `REQUIRED: "8–10% outer margin on all sides. Typography zone clearly delineated from hero zone by 7% whitespace. ` +
    `CTA button never touches any image edge. Logo at lower-right corner with 8% margin. ` +
    `Hero zone occupies 40–55% and is entirely unobstructed."`
  );

  return lines.join("\n");
}

// ─── S9: Commercial Details ───────────────────────────────────────────────────
// Commercially useful supporting elements — trust signals, triggers, register.

function buildS9(dir: GPTCampaignDirection): string {
  const lines = ["9. COMMERCIAL DETAILS"];

  if (dir.trustTriggers?.length) {
    lines.push(`Trust signals: ${dir.trustTriggers.map(t => sentence(cap(t))).join(" ")}`);
  }

  if (dir.mustInclude?.length) {
    lines.push(`Must include: ${dir.mustInclude.map(m => sentence(cap(m))).join(" ")}`);
  }

  if (dir.marketingTriggers?.length) {
    lines.push(`Psychological triggers: ${dir.marketingTriggers.join(", ")}.`);
  }

  if (dir.commercialStyle?.trim()) {
    lines.push(`Commercial register: ${sentence(cap(dir.commercialStyle))}`);
  }

  if (lines.length === 1) {
    lines.push("Maintain commercial integrity: every visual decision must serve the business objective, not only aesthetics.");
  }

  lines.push(
    `NOT: "Premium Indian aesthetic. Professional look." — ` +
    `REQUIRED: "Visual sophistication that matches Taj Hotels lobby photography. ` +
    `The Oberoi compositional restraint. ITC Hotels lighting quality. ` +
    `Every element justifies its presence through commercial purpose, not visual decoration."`
  );

  return lines.join("\n");
}

// ─── S10: Industry Reference ──────────────────────────────────────────────────
// Brand benchmarks specific to this industry.
// The model must match quality level — not copy visual identity.

function buildS10(industry: IndustryCategory): string {
  const ref = INDUSTRY_REF[industry] ?? INDUSTRY_REF.general;
  const brands = ref.brands.join(", ");

  return [
    "10. INDUSTRY REFERENCE",
    `Quality benchmark: Match the production quality and visual register of: ${brands}.`,
    `Visual style: ${ref.style}`,
    "Do not replicate these brands' visual identity. Match their production quality, compositional intelligence, and commercial sophistication.",
    `NOT: "Looks like a decent AI-generated image." — REQUIRED: "Indistinguishable from a paid production shoot for one of the benchmark brands above."`,
  ].join("\n");
}

// ─── S11: Quality Requirements ────────────────────────────────────────────────
// Non-negotiable quality mandate, emotional test, and hard constraints.

function buildS11(
  design: DesignDirectorOutput,
  photo: PhotographyDirectorOutput,
  dir: GPTCampaignDirection,
): string {
  const lines = ["11. QUALITY REQUIREMENTS"];

  lines.push(
    `Production benchmark: ${design.premiumFeel}. ` +
    `Match the visual quality and commercial sophistication of ${design.editorialFeel}.`
  );

  if (dir.viewerEmotion?.trim()) {
    const emotion = dir.viewerEmotion.trim().toLowerCase().replace(/[.!?]+$/, "");
    lines.push(
      `Emotional mandate: If the image does not immediately make the viewer feel ${emotion}, it fails. ` +
      `This is the single most important quality test — before any other criterion.`
    );
  }

  lines.push(
    "Required: Photorealistic commercial photography quality. " +
    "Advertising agency production standard. " +
    "Premium editorial styling. " +
    "Natural skin textures with realistic pore detail. " +
    "Physically accurate lighting with correct shadow falloff. " +
    "Luxury compositional intelligence. " +
    "Professional negative space management. " +
    "World-class commercial campaign standard."
  );

  const avoids: string[] = [
    "no text inside the image",
    "no logos inside the image",
    "no AI-generated plastic or waxy skin",
    "no stock photo poses",
    "no subject looking at camera",
    "no distorted anatomy or hands",
    "no empty decorative background blur without narrative purpose",
    "no competing focal points of equal weight",
    "no props outside this brief",
    "no crowded or cluttered composition",
    "no floating disconnected elements",
    "no incorrect perspective or keystoning",
    "no messy or ambiguous layout",
  ];

  if (photo.depth === "shallow") {
    avoids.push("background compression must support hero — never overpower it");
  }

  if (dir.mustAvoid?.length) {
    for (const a of dir.mustAvoid) {
      const clean = a.trim().toLowerCase();
      if (clean) avoids.push(clean);
    }
  }

  lines.push(`Hard constraints: ${avoids.join(", ")}.`);

  const messageClause = dir.coreMessage?.trim()
    ? firstClause(dir.coreMessage).toLowerCase().replace(/[.!?]+$/, "")
    : "the campaign's core message";

  lines.push(
    `NOT: "Beautiful premium image with good lighting and nice composition." — ` +
    `REQUIRED: "A commercial image that communicates '${messageClause}' ` +
    `within 2 seconds of viewing, at the production quality of a ₹5 lakh campaign shoot."`
  );

  return lines.join("\n");
}

// ─── Main compiler function ───────────────────────────────────────────────────

export interface CompilePromptInput {
  gptDirection: GPTCampaignDirection;
  design:       DesignDirectorOutput;
  photography:  PhotographyDirectorOutput;
  typography:   TypographyDirectorOutput;
  layout:       LayoutDirectorOutput;
  /** Raw industry value from strategy.business.industry.value — used to select Industry Reference. */
  industry?:    string;
}

export function compileDesignIntelligencePrompt(input: CompilePromptInput): string {
  const { gptDirection: dir, design, photography, typography, layout } = input;
  const industry = detectIndustryCategory(input.industry ?? "");

  return [
    PRIORITY_RULES,
    EXECUTION_DIRECTIVE,
    buildS1(dir),
    buildS2(dir, design),
    buildS3(dir, design, layout),
    buildS4(photography),
    buildS5(dir, photography),
    buildS6(dir, photography),
    buildS7(typography),
    buildS8(layout, design),
    buildS9(dir),
    buildS10(industry),
    buildS11(design, photography, dir),
    SELF_REVIEW_CHECKLIST,
  ]
    .map(s => s.trim())
    .filter(Boolean)
    .join("\n\n");
}
