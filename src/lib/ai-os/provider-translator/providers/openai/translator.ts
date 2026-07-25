import type { OptimizedPromptSpecification } from "../../../prompt-optimizer/types";
import type { PromptSpecification } from "../../../prompt-spec/types";
import type { ProviderPrompt, ProviderTranslatorImpl } from "../../types";
import {
  buildHeroSection,
  buildVisibleEmotionSection,
  buildSecondarySubjectsSection,
  buildEnvironmentSection,
  buildCompositionCameraSection,
  buildLightingSection,
  buildAdNarrativeSection,
  getNegatives,
  getRenderingDirective,
  estimateTokens,
} from "../../shared/section-builders";
import { validateAndScore } from "../../shared/validation";
import { OPENAI_QUALITY_SENTENCE, OPENAI_QUALITY_ANTI_PATTERNS, OPENAI_LIMITS } from "./quality";

// Phase 10.4G — OpenAI Semantic Compiler.
// Phase 10.4L — Hero-dominant hierarchy (image models weight early tokens most).
// [prompt-bloat fix] — a live trace measured ~9,100 char / ~2,270 token final
// prompts, dominated by non-visual marketing-strategy prose (MARKETING INTENT,
// ADVERTISEMENT ZONES, CAMPAIGN THEME — none describe what's physically in the
// photo) and found the "don't render text" instruction present but buried as
// one clause inside the final AVOID block, after every other section — a
// plausible cause of garbled in-image text ("Gutistaction") and cut-off layout
// elements. Fix: drop the non-visual blocks entirely (their data still lives
// in the blueprint/spec/trace — only excluded from this string), state the
// no-text instruction first and standalone instead of buried last, and
// compress the 6-sentence typography-zone prose to one line.
//
// Structure: semantic section labels — not flat "Primary scene:" prefixes.
// Block order:
//
//   NO TEXT              — stated first, standalone — the highest-priority instruction
//   PRIMARY HERO         — concrete visual anchor — first token wins
//   STORY CONTEXT        — specific narrative moment — sets the scene around the hero
//   VISIBLE EMOTION      — psychology → visible behaviour in the image
//   SECONDARY SUBJECTS   — full supporting cast with spatial relationships
//   CAMERA               — how to frame the hero
//   LIGHTING             — how to light the scene
//   BACKGROUND           — environment — subordinate to hero
//   [Keep-clear zones]   — compressed from 6 verbose sentences to one
//   [Mission brief]
//   [Quality directive]
//   AVOID: [merged negatives]
//
// Removed from this string (still fully present in PromptSpecification/
// UniversalCampaignBlueprint/runtime trace — only excluded from what's sent
// to the image provider): MARKETING INTENT (verbatim-duplicated two of its
// longest lines with VISIBLE EMOTION — confirmed by direct comparison, not
// assumed) and ADVERTISEMENT ZONES (ad-layout/graphic-design zone language —
// "BENEFIT BAR", "TRUST ELEMENT... badge" — not photography direction, and a
// plausible cause of the CTA-gets-cut-off symptom), plus CAMPAIGN THEME
// (empty in every case measured).
//
// NOT changed in this pass, flagged for a separate step:
//  - Word-doubling ("positioned positioned", "of the frame of the frame") is
//    a template-substitution bug in an upstream builder, unrelated to section
//    filtering.
//  - SECONDARY SUBJECTS' `supportingSubjects` field value has an
//    "ADVERTISEMENT LAYERS: ..." fragment already baked into the raw string
//    upstream of this file and shared/section-builders.ts — not cleanly
//    separable without touching that upstream builder, which is out of this
//    change's file scope.
//  - `OPENAI_QUALITY_ANTI_PATTERNS` (quality.ts, not touched here) still
//    includes "distorted text", which — read alone — mildly implies text
//    rendering is otherwise acceptable. The new standalone NO TEXT
//    instruction above is unambiguous and stated first, so it should
//    dominate, but fully resolving the mixed signal means editing quality.ts
//    too, in a future change.

const TRANSLATOR_VERSION = "2.0.0";

function v(field: { value: string } | undefined): string {
  if (!field || field.value === "unknown") return "";
  return field.value;
}

/** Extracts the leading position phrase from a verbose zone description (up
 *  to the first em-dash or period) — e.g. "Zone immediately below the hero
 *  image — anchored to the visual, within the safe margin" becomes "Zone
 *  immediately below the hero image". Used only to compress the 6-sentence
 *  typography-zone block down to one "leave this space clear" line. */
function leadingPhrase(text: string): string {
  const cut = text.search(/[—.]/);
  return (cut === -1 ? text : text.slice(0, cut)).trim();
}

function buildOpenAIPrompt(
  spec: PromptSpecification,
  optimized: OptimizedPromptSpecification
): string {
  const blocks: string[] = [];

  // ── NO TEXT ──────────────────────────────────────────────────────────────────
  // Stated first and standalone — not one clause buried inside AVOID after
  // every other section. This is the single most safety-critical instruction
  // in the prompt (see file header for why).
  blocks.push(
    "Do not render any text, letters, words, numbers, or logos anywhere in this image — leave those areas completely clean and empty. All headline, caption, CTA, and disclaimer text will be added separately in post-production."
  );

  // ── PRIMARY HERO ────────────────────────────────────────────────────────────
  // Phase 10.4L: block 0 — concrete visual anchor, never abstract.
  // Full identity, pose, action, expression, micro-detail, frame weight.
  // Never "Chef preparing food." — preserve every qualifier and action verb.
  const hero = buildHeroSection(spec);
  if (hero) {
    const nonNeg = v(spec.mission.nonNegotiableElement);
    const critical = nonNeg ? `\n\nCRITICAL: ${nonNeg}` : "";
    blocks.push(`PRIMARY HERO\n${hero}.${critical}`);
  }

  // ── STORY CONTEXT ─────────────────────────────────────────────────────────
  // Phase 10.4J — Ad Intelligence: specific scene happening + emotional beat.
  // Phase 10.4L: moved to block 1 — narrative grounds the hero in a specific moment.
  const adNarrative = buildAdNarrativeSection(spec);
  if (adNarrative) blocks.push(`STORY CONTEXT\n${adNarrative}.`);

  // ── VISIBLE EMOTION ──────────────────────────────────────────────────────────
  // Psychology converted to visible behaviour. "Trust" → what trust looks like.
  const emotion = buildVisibleEmotionSection(spec);
  if (emotion) blocks.push(`VISIBLE EMOTION\n${emotion}.`);

  // ── SECONDARY SUBJECTS ───────────────────────────────────────────────────────
  // All supporting people, objects, and decorative elements with relationships.
  const secondary = buildSecondarySubjectsSection(spec);
  if (secondary) blocks.push(`SECONDARY SUBJECTS\n${secondary}.`);

  // ── CAMERA ───────────────────────────────────────────────────────────────────
  // Full composition + camera storytelling.
  // Reads: composition (all), camera (all 6 fields).
  const camera = buildCompositionCameraSection(spec);
  if (camera) blocks.push(`CAMERA\n${camera}.`);

  // ── LIGHTING ─────────────────────────────────────────────────────────────────
  const lighting = buildLightingSection(spec);
  if (lighting) blocks.push(`LIGHTING\n${lighting}.`);

  // ── BACKGROUND ───────────────────────────────────────────────────────────────
  // Phase 10.4L: moved to block 7 — environment is subordinate to hero.
  // Was block 6; moved after CAMERA and LIGHTING so hero framing decisions
  // are established before the environment is described.
  const background = buildEnvironmentSection(spec);
  if (background) blocks.push(`BACKGROUND\n${background}.`);

  // ── KEEP-CLEAR ZONES ─────────────────────────────────────────────────────────
  // Compressed from 6 verbose zone sentences (533 chars measured) to their
  // position phrases only — the detailed "anchored to the visual, within the
  // safe margin"-style prose duplicated what the NO TEXT instruction above
  // already establishes (nothing should be drawn there at all). Dynamic, not
  // a static sentence — derived from this campaign's own reserved-area
  // fields, so it varies per layout instead of repeating fixed text.
  const zonePositions = [
    v(spec.typography.reservedHeadlineArea),
    v(spec.typography.reservedCtaArea),
    v(spec.typography.reservedLogoArea),
  ].filter(Boolean).map(leadingPhrase).filter(Boolean);
  if (zonePositions.length) {
    blocks.push(`Leave clean, empty space at: ${zonePositions.join("; ")} — reserved for text and logo in post-production.`);
  }

  // ── MISSION BRIEF ──────────────────────────────────────────────────────────
  // Phase 10.4L: moved to block 11 (from block 0) — abstract executive directive
  // after all concrete visuals. Image models weight early tokens most; abstract
  // framing is less useful at position 0 than a concrete hero description.
  const whatToGenerate = v(spec.mission.whatToGenerate);
  if (whatToGenerate) blocks.push(whatToGenerate);

  // ── QUALITY ──────────────────────────────────────────────────────────────────
  const renderingDirective = getRenderingDirective(optimized);
  const qualityBlock = renderingDirective
    ? `${OPENAI_QUALITY_SENTENCE} ${renderingDirective}.`
    : OPENAI_QUALITY_SENTENCE;
  blocks.push(qualityBlock);

  // ── AVOID ────────────────────────────────────────────────────────────────────
  // Merged negatives + technical anti-patterns.
  const negatives    = getNegatives(optimized);
  const antiPatterns = OPENAI_QUALITY_ANTI_PATTERNS.join(", ");
  const avoidList    = [negatives, antiPatterns].filter(Boolean).join(", ");
  if (avoidList) blocks.push(`AVOID: ${avoidList}.`);

  return blocks.filter(Boolean).join("\n\n");
}

class OpenAITranslator implements ProviderTranslatorImpl {
  readonly provider  = "openai" as const;
  readonly version   = TRANSLATOR_VERSION;

  translate(optimized: OptimizedPromptSpecification): ProviderPrompt {
    const spec = optimized.optimizedSpec;

    // Phase 10.4K.2 — Modern translator path.
    // Default: buildOpenAIPrompt() (section-builder path — includes marketing,
    // ad narrative, campaign theme, typography). Legacy path preserved behind
    // OPENAI_LEGACY_TRANSLATOR=true for rollback if needed.
    const isLegacyMode = process.env.OPENAI_LEGACY_TRANSLATOR === "true";

    // When a validated GPT narrative exists AND legacy mode is enabled, use it
    // as the base. In modern mode (default), gptNarrative is ignored and
    // buildOpenAIPrompt() assembles the prompt from all structured spec fields.
    const gptNarrative         = spec.gptNarrative;
    const isGPTNarrativeActive = isLegacyMode && !!(gptNarrative && gptNarrative.quality.status !== "failed");

    let finalPrompt: string;
    if (isGPTNarrativeActive) {
      finalPrompt = gptNarrative.narrativePrompt;
      // Append quality and negatives (negatives already woven into narrative,
      // so only append technical anti-patterns)
      const renderingDirective = getRenderingDirective(optimized);
      finalPrompt += renderingDirective
        ? ` ${OPENAI_QUALITY_SENTENCE} ${renderingDirective}.`
        : ` ${OPENAI_QUALITY_SENTENCE}`;
      const antiPatterns = OPENAI_QUALITY_ANTI_PATTERNS.join(", ");
      if (antiPatterns) finalPrompt += ` AVOID: ${antiPatterns}.`;
    } else {
      finalPrompt = buildOpenAIPrompt(spec, optimized);
    }

    // Hard cap — only triggers if the spec is pathologically large
    if (finalPrompt.length > OPENAI_LIMITS.maxLength) {
      finalPrompt = finalPrompt.slice(0, OPENAI_LIMITS.maxLength - 3) + "...";
    }

    const orderedSections = [
      "noText", "hero", "story", "emotion", "secondary",
      "camera", "lighting", "background", "keepClearZones",
      "intent", "quality", "negatives",
    ];
    const quality = validateAndScore(finalPrompt, undefined, optimized, OPENAI_LIMITS);

    return {
      meta: {
        provider:             "openai",
        providerVersion:      OPENAI_LIMITS.providerVersion,
        translatorVersion:    TRANSLATOR_VERSION,
        createdAt:            new Date().toISOString(),
        sourceOptimizationId: optimized.meta.optimizationId,
        sourceSpecId:         spec.meta.specId,
      },
      body: {
        finalPrompt,
        orderedSections,
        estimatedPromptLength: finalPrompt.length,
        estimatedTokenCount:   estimateTokens(finalPrompt),
        formatStyle:           "prose",
      },
      quality,
    };
  }
}

export const openaiTranslator = new OpenAITranslator();
