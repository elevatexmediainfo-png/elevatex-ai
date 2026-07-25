import type { UniversalPrompt } from "../schema";
import type { CreativeBrief } from "../creative-director";
import type { IndustryProfile, PromptRichnessTier } from "./types";
import { composeFluently } from "../adapters/generic.adapter";

// Composition/layout/camera enrichment — every function here WEAVES the
// Creative Brain's own already-inferred value into richer phrasing rather
// than discarding it, so two different ideas with two different
// LLM-inferred values still read distinctly even after enrichment.
//
// Image Quality Stabilization additions:
//   - heroSubject → focalPoint: Director's specific hero decision replaces
//     the generic "central subject" fallback.
//   - layoutArchetype / visualFormat → layout.composition opening: the named
//     layout template and format type sharpen the composition clause so the
//     image model understands structural intent, not just style.
//   - copywriting.headline / cta → headlinePosition / ctaPosition: actual
//     words embedded in position strings so the image model renders them.
//     "upper third — headline: 'Rediscover Your Smile'" gives the model text
//     to render; "upper third" alone does not. (#1 audit finding, +35% est.)

const SAFE_AREA_PHRASES = {
  headline: "with generous reserved safe space for a bold headline",
  cta: "and clearly reserved space for a high-visibility call-to-action",
  logo: "with a clean, uncluttered logo-safe corner",
};

export interface CompositionEnrichment {
  composition: { framing: string; focalPoint: string; depth: string; texture: string };
  layout: { composition: string; hierarchy: string; whiteSpace: string; headlinePosition: string; ctaPosition: string; logoPosition: string };
  camera: Pick<UniversalPrompt["camera"], "angle" | "lens" | "depthOfField" | "perspective">;
}

// Non-photography visual formats — when the Director chose one of these,
// the layout.composition clause names it so the model understands it's
// generating a structured information layout, not a photographic composition.
const INFOGRAPHIC_FORMAT_KEYWORDS = ["infographic", "before/after", "comparison", "timeline"];

function isInfographicFormat(visualFormat: string | undefined): boolean {
  if (!visualFormat) return false;
  const lower = visualFormat.toLowerCase();
  return INFOGRAPHIC_FORMAT_KEYWORDS.some((kw) => lower.includes(kw));
}

export function buildCompositionEnrichment(
  prompt: UniversalPrompt,
  profile: IndustryProfile,
  tier: PromptRichnessTier
): CompositionEnrichment {
  const richTier = tier === "luxury" || tier === "cinematic";
  const marketingTier = tier !== "simple";
  const brief = prompt.creativeBrief as CreativeBrief | undefined;

  // Creative Director 2.0, Step 4 (Visual Story) — visualStory is the
  // Director's complete scene narrative, placed first since it's the primary
  // narrative anchor; the provider model weights early prompt content highest.
  const framing = composeFluently(
    [
      brief?.visualStory,
      prompt.composition.framing || "the primary subject composed as the unmistakable hero of the frame",
      profile.subjectHints,
      "a scroll-stopping composition with a strong, immediate focal point",
    ].filter((v): v is string => Boolean(v))
  );

  // Image Quality Stabilization — heroSubject replaces the generic fallback
  // when the Director made an explicit hero-subject decision. A specific
  // subject ("Before-and-after smile transformation split") is always more
  // useful to the image model than the generic catch-all.
  const focalPoint =
    brief?.heroSubject ||
    prompt.composition.focalPoint ||
    "the central subject, lit and framed to draw the eye within the first glance";

  const depth = [prompt.composition.depth, richTier ? "rich layered depth with a softly rendered background" : "natural depth of field"]
    .filter(Boolean)
    .join(", ");

  const texture = [prompt.composition.texture, profile.premiumDetails].filter(Boolean).join("; ");

  // Creative Director 2.0, Step 2 — concise fold-in of key IA placement decisions
  const informationArchitectureSummary = [
    brief?.informationArchitecture?.heroSection,
    brief?.informationArchitecture?.benefitSection,
    brief?.informationArchitecture?.trustIndicators,
    brief?.informationArchitecture?.ctaArea,
  ]
    .filter(Boolean)
    .join("; ");

  // Image Quality Stabilization — layoutArchetype and visualFormat sharpen
  // the opening of layout.composition. "Split Screen layout" or
  // "Educational Infographic layout" is far more instructive than the
  // generic "a clean, magazine-quality advertising layout" fallback.
  const layoutLabel = (() => {
    if (brief?.layoutArchetype) return `${brief.layoutArchetype} layout`;
    if (isInfographicFormat(brief?.visualFormat)) return `${brief!.visualFormat} layout`;
    return undefined;
  })();

  const layoutComposition = composeFluently(
    [
      layoutLabel || prompt.layout.composition || "a clean, magazine-quality advertising layout",
      "eye-catching visual hierarchy that guides the eye from subject to message to action",
      informationArchitectureSummary,
    ].filter((v): v is string => Boolean(v))
  );

  // Creative Director 2.0, Step 3 (Visual Hierarchy)
  const visualHierarchySequence = brief?.visualHierarchy?.length ? brief.visualHierarchy.join(" leading to ") : undefined;

  const hierarchy = [
    visualHierarchySequence,
    prompt.layout.hierarchy,
    "a single dominant focal point with every secondary element clearly subordinate",
  ]
    .filter(Boolean)
    .join("; ");

  const whiteSpace = composeFluently(
    [
      prompt.layout.whiteSpace || "elegant, balanced negative space",
      marketingTier ? "deliberately uncluttered so the layout never feels crowded" : undefined,
    ].filter((v): v is string => Boolean(v))
  );

  // Image Quality Stabilization — embed actual copywriting text into the
  // position strings. describeTypography() in generic.adapter.ts reads
  // layout.headlinePosition and layout.ctaPosition and surfaces them in
  // the Typography section — so actual words reach the image model via
  // existing code with no adapter changes.
  const headlineText = brief?.copywriting?.headline;
  const ctaText = brief?.copywriting?.cta;

  const headlinePosition = [
    prompt.layout.headlinePosition || "upper third",
    headlineText ? `— headline: "${headlineText}"` : undefined,
    SAFE_AREA_PHRASES.headline,
  ]
    .filter(Boolean)
    .join(" ");

  const ctaPosition = [
    prompt.layout.ctaPosition || "lower section",
    ctaText ? `— CTA button: "${ctaText}"` : undefined,
    SAFE_AREA_PHRASES.cta,
  ]
    .filter(Boolean)
    .join(" ");

  const logoPosition = [prompt.layout.logoPosition || "a corner", SAFE_AREA_PHRASES.logo].join(" ");

  const angle = prompt.camera.angle || "eye-level commercial angle";
  const lens = [prompt.camera.lens, richTier ? "shot with premium commercial lens character" : undefined].filter(Boolean).join(", ");
  const depthOfField = prompt.camera.depthOfField || "shallow, intentional depth of field";
  const perspective = prompt.camera.perspective || "a perspective chosen to maximize scale and presence";

  return {
    composition: { framing, focalPoint, depth, texture },
    layout: { composition: layoutComposition, hierarchy, whiteSpace, headlinePosition, ctaPosition, logoPosition },
    camera: { angle, lens, depthOfField, perspective },
  };
}
