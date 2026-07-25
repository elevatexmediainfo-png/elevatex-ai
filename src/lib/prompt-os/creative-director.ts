import { z } from "zod";

import { generateScript } from "@/lib/generation/llm";
import { section, stringArray, sectionOrString, stringOrJoinedString } from "./schema";
import { parseJsonLoose, buildContextLines, type PromptOsContextInput } from "./builder";

// Phase 2.4 — AI Creative Director: a standalone strategic-thinking step
// that runs BEFORE any Universal JSON Prompt is built, the same pattern
// Reference Intelligence (design-intelligence/analyze-asset.ts) already
// established — one generateScript() call producing a schema-validated
// structured object, never raw provider prompts. This module is
// deliberately provider-independent: it imports nothing from
// lib/providers/image or lib/prompt-os/adapters, only the same
// provider-agnostic generateScript() every other intelligence step uses.
//
// Creative Director 2.0 — Advertising Campaign Intelligence: the Director's
// job expanded from "describe a beautiful image" to "design a complete
// advertising campaign" (information architecture, visual hierarchy, a real
// narrative scene instead of an isolated subject, advertisement composition,
// a design system, a scroll-stopping strategy).
//
// Image Quality Stabilization — Decision Quality: 5 new fields after live
// audit confirmed they were missing:
//   - visualFormat: type of creative — never assumed to be "poster"
//   - heroSubject: most powerful marketing visual, deliberately chosen
//   - layoutArchetype: named structural template
//   - visualDensity: drives Expander phrase-bank tier selection
//   - copywriting: actual render-ready words (headline/CTA/benefits), not
//     placeholder descriptions — the #1 quality-improvement finding from the
//     live audit (+35% estimated impact from image model rendering real text).
export const creativeBriefSchema = z.object({
  businessSummary: z.string().optional(),
  marketingObjective: z.string().optional(),
  creativeObjective: z.string().optional(),
  targetAudience: z.string().optional(),
  brandPersonality: z.string().optional(),
  // STEP 1 — Campaign Analysis
  valueProposition: z.string().optional(),
  creativeApproach: z.string().optional(),

  // STEP 0 — Format & Hero Decision (Image Quality Stabilization)
  /** What TYPE of creative: "Editorial Advertisement" | "Educational Infographic" |
   *  "Before/After" | "Comparison Creative" | "Luxury Campaign" | "Corporate Poster" |
   *  "Product Highlight" | "Magazine Layout" | "Social Media Advertisement" |
   *  "Minimal Campaign" | "Story Layout" */
  visualFormat: z.string().optional(),
  /** Single strongest visual marketing element. NOT "doctor smiling" / "person smiling"
   *  unless genuinely optimal. Concrete: "Patient following post-op precautions",
   *  "SIP compound growth chart", "Before-and-after smile transformation" */
  heroSubject: z.string().optional(),
  /** Named structural template: "Editorial" | "Split Screen" | "Infographic" |
   *  "Magazine Cover" | "Hero + Benefits" | "Timeline" | "Premium Grid" |
   *  "Luxury Editorial" | "Product Spotlight" | "Comparison" */
  layoutArchetype: z.string().optional(),
  /** Drives Expander phrase-bank depth: "minimal" | "medium" | "rich" */
  visualDensity: z.string().optional(),

  visualStrategy: section({
    visualDirection: stringOrJoinedString().optional(),
    emotionalDirection: stringOrJoinedString().optional(),
    luxuryLevel: stringOrJoinedString().optional(),
    minimalismLevel: stringOrJoinedString().optional(),
    realismLevel: stringOrJoinedString().optional(),
    storyDirection: stringOrJoinedString().optional(),
  }),

  // STEP 4 — Visual Story: complete narrative scene, never isolated subject
  visualStory: z.string().optional(),
  // STEP 3 — Visual Hierarchy: ordered eye-flow sequence
  visualHierarchy: stringArray().optional(),

  // STEP 2 — Information Architecture: content placement planning
  // All string fields use stringOrJoinedString() so null and arrays from the
  // LLM are safely coerced (null→undefined, array→joined string) rather than
  // causing a ZodError on an otherwise correct response.
  informationArchitecture: section({
    heroSection: stringOrJoinedString().optional(),
    headline: stringOrJoinedString().optional(),
    supportingCopy: stringOrJoinedString().optional(),
    featureIcons: stringOrJoinedString().optional(),
    benefitSection: stringOrJoinedString().optional(),
    trustIndicators: stringOrJoinedString().optional(),
    testimonialArea: stringOrJoinedString().optional(),
    ctaArea: stringOrJoinedString().optional(),
    contactSection: stringOrJoinedString().optional(),
    brandArea: stringOrJoinedString().optional(),
    logoSafeArea: stringOrJoinedString().optional(),
  }),

  messagingStrategy: section({
    primaryMessage: stringOrJoinedString().optional(),
    secondaryMessage: stringOrJoinedString().optional(),
    headlineDirection: stringOrJoinedString().optional(),
    trustSignals: stringArray().optional(),
  }),

  colorPsychology: z.string().optional(),
  layoutDirection: z.string().optional(),

  // Confirmed live with gpt-4o-mini: sometimes collapses to a bare string
  compositionStrategy: sectionOrString({ compositionPriority: z.string().optional() }, "compositionPriority"),

  // STEP 5 — Advertisement Composition: literal visual layout elements
  advertisementComposition: section({
    heroImage: stringOrJoinedString().optional(),
    supportingVisuals: stringOrJoinedString().optional(),
    backgroundStory: stringOrJoinedString().optional(),
    informationCards: stringOrJoinedString().optional(),
    premiumUIPanels: stringOrJoinedString().optional(),
    floatingCards: stringOrJoinedString().optional(),
    premiumGlassSections: stringOrJoinedString().optional(),
    ctaBlocks: stringOrJoinedString().optional(),
    logoPlacement: stringOrJoinedString().optional(),
    contactInformation: stringOrJoinedString().optional(),
    editorialGrid: stringOrJoinedString().optional(),
  }),

  // STEP 7 — Premium Elements: curated subset, never "include everything"
  premiumElements: stringArray().optional(),

  // Confirmed live: LLM sometimes returns an object for this string field
  typographyStrategy: stringOrJoinedString().optional(),

  // STEP 8 — Design System: technical specification
  designSystem: section({
    gridSystem: stringOrJoinedString().optional(),
    alignment: stringOrJoinedString().optional(),
    typographyScale: stringOrJoinedString().optional(),
    fontPairing: stringOrJoinedString().optional(),
    iconStyle: stringOrJoinedString().optional(),
    colorHarmony: stringOrJoinedString().optional(),
    visualRhythm: stringOrJoinedString().optional(),
    balance: stringOrJoinedString().optional(),
    contrast: stringOrJoinedString().optional(),
    depth: stringOrJoinedString().optional(),
    shadows: stringOrJoinedString().optional(),
    whiteSpace: stringOrJoinedString().optional(),
  }),

  callToAction: z.string().optional(),
  attentionHook: z.string().optional(),

  // STEP 9 — Scroll-Stopping Strategy
  scrollStoppingStrategy: z.string().optional(),

  platformOptimization: z.string().optional(),
  creativeConfidence: z.string().optional(),

  // STEP 10 — Copywriting (Image Quality Stabilization)
  // Actual render-ready marketing text — distinct from informationArchitecture
  // (describes placement/structure) and callToAction (describes strategic intent).
  // These literals flow into layout.headlinePosition/ctaPosition via composition.ts
  // so the image model receives the actual words to render, not just "headline area".
  copywriting: section({
    /** Actual text ≤6 words: "Rediscover Your Smile" not "A headline about implants" */
    headline: stringOrJoinedString().optional(),
    subheadline: stringOrJoinedString().optional(),
    /** Button text only, no punctuation: "Book Free Consultation" */
    cta: stringOrJoinedString().optional(),
    /** 2–4 short benefit labels: ["Permanent", "Natural-Looking", "Pain-Free"] */
    benefitTitles: stringArray().optional(),
    featureLabels: stringArray().optional(),
    trustStatements: stringArray().optional(),
    badgeText: stringOrJoinedString().optional(),
  }),
});

export type CreativeBrief = z.infer<typeof creativeBriefSchema>;

export type BuildCreativeBriefInput = PromptOsContextInput;

// 11-step advertising-campaign planning process. Step 0 (Format & Hero
// Decision) runs before Step 1 (Campaign Analysis) because the format
// decision drives layout, density, and hero subject — all of which must
// be settled before planning the rest of the campaign.
const SYSTEM_PROMPT =
  "You are an Executive Creative Director at a world-class advertising agency (Apple/Nike/Google/Adobe/Airbnb/" +
  "Rolex/Tesla caliber). You never think like an AI prompt writer — your responsibility is not to create a " +
  "beautiful image, it is to design a complete advertising campaign. You never ask the user questions — you " +
  "infer everything from their one-sentence idea (and, when given, a reference image's analyzed visual style " +
  "and the user's brand colors/voice). Before writing anything, complete this planning process:\n\n" +
  "STEP 0 — FORMAT & HERO DECISION: Decide two things before anything else. (A) What TYPE of creative is this? " +
  "Choose exactly one visualFormat: \"Editorial Advertisement\", \"Educational Infographic\", \"Before/After\", " +
  "\"Comparison Creative\", \"Luxury Campaign\", \"Corporate Poster\", \"Product Highlight\", " +
  "\"Magazine Layout\", \"Social Media Advertisement\", \"Minimal Campaign\", or \"Story Layout\". Never " +
  "default to a generic poster — choose the format that best serves the marketing objective. " +
  "(B) Who or what is the heroSubject — the single most powerful visual marketing element? This is NOT always " +
  "a smiling person or a doctor. It may be a process diagram, a product detail, a transformation result, a " +
  "data visualization, a lifestyle moment, or a symbolic object. Make a specific, deliberate choice. Also " +
  "choose layoutArchetype: \"Editorial\", \"Split Screen\", \"Infographic\", \"Magazine Cover\", " +
  "\"Hero + Benefits\", \"Timeline\", \"Premium Grid\", \"Luxury Editorial\", \"Product Spotlight\", or " +
  "\"Comparison\". Set visualDensity: \"minimal\" (luxury/editorial — few elements, maximum impact), " +
  "\"medium\" (standard advertising — focused with supporting elements), or \"rich\" (infographic/ " +
  "comparison/feature-heavy — information is the product).\n\n" +
  "STEP 1 — CAMPAIGN ANALYSIS: What is being sold? Why would someone care (the value proposition, not just the " +
  "offer)? What emotion should be created? What marketing objective matters most? Should this creative educate, " +
  "persuade, inspire, reassure, build trust, or generate urgency? What is the single strongest marketing " +
  "message?\n\n" +
  "STEP 2 — INFORMATION ARCHITECTURE: think about an advertisement, not an image. Decide what occupies the hero " +
  "section, headline, supporting copy, feature icons, benefit section, trust indicators, testimonial area, CTA " +
  "area, contact section, brand area, and logo safe area. Every advertisement needs a logical information " +
  "hierarchy.\n\n" +
  "STEP 3 — VISUAL HIERARCHY: plan exactly how the viewer's eye should move, as an ordered sequence (e.g. " +
  "Headline -> Hero Subject -> Supporting Information -> Benefits -> Social Proof -> CTA -> Logo). The viewer " +
  "must understand the advertisement within three seconds.\n\n" +
  "STEP 4 — VISUAL STORY: never describe an isolated subject. Always describe a complete story. Wrong: \"Doctor " +
  "smiling.\" Correct: \"An experienced implant specialist confidently explaining a realistic dental implant " +
  "model to a reassured patient inside a premium modern clinic immediately after surgery.\" The scene must " +
  "communicate the marketing message before anyone reads any text.\n\n" +
  "STEP 5 — ADVERTISEMENT COMPOSITION: do not plan a photograph — plan a complete premium advertising layout: " +
  "hero image, supporting visuals, background story, information cards, premium UI panels, floating cards, " +
  "premium glass sections, CTA blocks, logo placement, contact information, and editorial grid.\n\n" +
  "STEP 6 — INDUSTRY INTELLIGENCE: every industry has its own visual language (healthcare: premium clinic, " +
  "trust, cleanliness, certifications; restaurant: steam, food close-up, appetite appeal; real estate: luxury " +
  "architecture, golden hour, lifestyle; finance: wealth, security, growth; education: vibrant campus, student " +
  "achievement, possibility; automobile: engineering precision, open road, dynamic angles; salon: soft beauty " +
  "studio, transformation, self-care; jewellery: macro precision, luxury setting, gallery quality). Apply this " +
  "thinking naturally across every field above — never a generic layout.\n\n" +
  "STEP 7 — PREMIUM ADVERTISING ELEMENTS: decide which of these actually improve communication for THIS idea — " +
  "benefit cards, statistics, comparison, testimonials, icons, timeline, before/after, product highlights, " +
  "callout boxes, trust badges, ratings, certifications, process flow, feature grid. Only include elements that " +
  "genuinely help; never include everything.\n\n" +
  "STEP 8 — DESIGN SYSTEM: determine grid system, alignment, typography scale, font pairing, icon style, color " +
  "harmony, visual rhythm, balance, contrast, depth, shadows, and white space. Never cluttered.\n\n" +
  "STEP 9 — SCROLL-STOPPING STRATEGY: within the first two seconds the viewer must understand what, why, who, " +
  "and what to do next. Maximize CTR, engagement, saves, shares, readability, and premium perception.\n\n" +
  "STEP 10 — COPYWRITING: generate the actual render-ready marketing text — NOT descriptions of what to write, " +
  "but the exact words. headline: 6 words maximum, punchy, benefit-driven (e.g. \"Rediscover Your Smile\" NOT " +
  "\"A headline about dental implants\"). subheadline: one clear supporting line. cta: button text only, no " +
  "punctuation, action verb first (\"Book Free Consultation\" NOT \"Click here to book a consultation\"). " +
  "benefitTitles: 2-4 short parallel labels ([\"Permanent\", \"Natural-Looking\", \"Pain-Free\"]). " +
  "trustStatements: 1-3 credibility phrases. badgeText: short badge label if applicable.\n\n" +
  "Return ONLY a single JSON object (no markdown, no prose, no code fences) with these top-level keys: " +
  "businessSummary, marketingObjective, creativeObjective, targetAudience, brandPersonality, valueProposition, " +
  "creativeApproach, visualFormat, heroSubject, layoutArchetype, visualDensity, visualStrategy (visualDirection/" +
  "emotionalDirection/luxuryLevel/minimalismLevel/realismLevel/storyDirection), visualStory, visualHierarchy " +
  "(ordered array), informationArchitecture (heroSection/headline/supportingCopy/featureIcons/benefitSection/" +
  "trustIndicators/testimonialArea/ctaArea/contactSection/brandArea/logoSafeArea), messagingStrategy " +
  "(primaryMessage/secondaryMessage/headlineDirection/trustSignals array), colorPsychology, layoutDirection, " +
  "compositionStrategy (compositionPriority), advertisementComposition (heroImage/supportingVisuals/" +
  "backgroundStory/informationCards/premiumUIPanels/floatingCards/premiumGlassSections/ctaBlocks/logoPlacement/" +
  "contactInformation/editorialGrid), premiumElements (array of only elements that genuinely help), " +
  "typographyStrategy, designSystem (gridSystem/alignment/typographyScale/fontPairing/iconStyle/colorHarmony/" +
  "visualRhythm/balance/contrast/depth/shadows/whiteSpace), callToAction, attentionHook, " +
  "scrollStoppingStrategy, platformOptimization, creativeConfidence, and copywriting (headline/subheadline/" +
  "cta/benefitTitles/featureLabels/trustStatements/badgeText). Every decision must be deliberate — never a " +
  "generic placeholder.";

function buildUserMessage(input: BuildCreativeBriefInput): string {
  const lines = buildContextLines(input);
  lines.push("", "Design the complete advertising campaign for this idea.");
  return lines.join("\n");
}

export async function buildCreativeBrief(input: BuildCreativeBriefInput, userId: string): Promise<CreativeBrief> {
  const result = await generateScript(
    {
      prompt: buildUserMessage(input),
      contentLanguage: "EN",
      systemPrompt: SYSTEM_PROMPT,
      responseFormat: "json",
    },
    { userId },
    "creative_direction"
  );

  let parsed: unknown;
  try {
    parsed = parseJsonLoose(result.text);
  } catch {
    throw new Error("Creative direction did not return valid JSON.");
  }

  return creativeBriefSchema.parse(parsed);
}
