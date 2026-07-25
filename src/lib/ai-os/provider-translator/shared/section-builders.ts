import type { OptimizedPromptSpecification } from "../../prompt-optimizer/types";
import type { PromptSpecification } from "../../prompt-spec/types";

// Phase 10.4G — Semantic Compiler, not a Summarizer.
//
// RULES (enforced here, never violated):
//   ✗ Never reduce. Never simplify. Never collapse.
//   ✗ No generic replacements ("Chef preparing food." is a failure).
//   ✗ No information loss. No sentence shortening.
//   ✓ Read every available field — previously-dead fields are now active.
//   ✓ Prefer longer, richer prose over short generic phrases.
//   ✓ The provider prompt should be longer if needed — quality first.

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Estimates token count from character count (English ~4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Gets a field value safely, returning "" for unknown or missing fields. */
function val(field: { value: string } | undefined): string {
  if (!field || field.value === "unknown") return "";
  return field.value;
}

/** Converts underscore-separated enum strings to readable prose. */
function expand(v: string): string {
  return v.replace(/_/g, " ");
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY HERO
// Full identity, pose, action, expression, micro-detail, frame weight.
// Keep the complete hero — never summarise to "Chef" or "Doctor".
// ─────────────────────────────────────────────────────────────────────────────

export function buildHeroSection(spec: PromptSpecification): string {
  const subject    = val(spec.hero.heroSubject);
  const position   = val(spec.hero.heroPosition);
  const scale      = val(spec.hero.heroScale);
  const details    = val(spec.hero.heroDetails);
  const importance = val(spec.hero.heroImportance);

  if (!subject) return "";

  const parts: string[] = [subject];

  if (position) parts.push(`Positioned ${expand(position)} of the frame`);
  if (scale)    parts.push(`Occupying ${expand(scale)} frame weight`);

  if (details && !details.includes("Product-only")) parts.push(details);

  if (importance === "absolute_mandatory")
    parts.push(
      "This subject is the unmistakable visual anchor — every composition, lighting, and depth decision must serve it"
    );

  return parts.join(". ");
}

// ─────────────────────────────────────────────────────────────────────────────
// VISIBLE EMOTION
// Convert psychology into visible behaviour, not abstract states.
// "Trust" → what trust looks like. "Emotion" → what the face/body does.
// Reads: experienceEmotionalCore, experienceVisualImplication, emotionalGoal,
//        trustStrategy (was dead), conversionIntent (was dead).
// ─────────────────────────────────────────────────────────────────────────────

// [prompt-bloat fix] Every field read here (except conversionIntent, dropped
// below) resolves to a concrete visible detail in practice — verified against
// real campaign output, not assumed from field names. The problem was never
// the content, it was the labels: "Core psychological driver:", "Audience
// desire this image activates:" etc. read as marketing strategy even when the
// sentence that follows is purely visual. Labels removed; sentences kept
// as-is, joined the same bare, period-separated way buildHeroSection() and
// buildLightingSection() already do. conversionIntent is dropped entirely —
// its value describes a hypothetical viewer's internal thought ("The viewer
// thinks: this is who I want doing this for me"), never anything physically
// in frame, in every case measured.
export function buildVisibleEmotionSection(spec: PromptSpecification): string {
  const expCore    = val(spec.marketing.experienceEmotionalCore);
  const expVisual  = val(spec.marketing.experienceVisualImplication);
  const emotion    = val(spec.marketing.emotionalGoal);
  const trust      = val(spec.marketing.trustStrategy);
  // Phase 10.4H — activated:
  const painPoints     = val(spec.marketing.audiencePainPoints);
  const desires        = val(spec.marketing.audienceDesires);
  const emotionalDrv   = val(spec.marketing.emotionalDriver);

  const parts: string[] = [];
  if (expCore)              parts.push(expCore);
  if (expVisual)            parts.push(expVisual);
  if (emotion && !expCore)  parts.push(emotion);
  if (emotionalDrv)         parts.push(emotionalDrv);
  if (painPoints)           parts.push(painPoints);
  if (desires)              parts.push(desires);
  if (trust)                parts.push(trust);

  return parts.filter(Boolean).join(". ");
}

// ─────────────────────────────────────────────────────────────────────────────
// SECONDARY SUBJECTS
// Every supporting person, object, and decorative element with their
// spatial relationships and narrative roles — preserved completely.
// Reads: supportingSubjects, relationships (was dead), requiredObjects,
//        optionalObjects, decorativeElements (was dead).
// ─────────────────────────────────────────────────────────────────────────────

export function buildSecondarySubjectsSection(spec: PromptSpecification): string {
  const subjects      = val(spec.supporting.supportingSubjects);
  const relationships = val(spec.supporting.relationships);
  const required      = val(spec.supporting.requiredObjects);
  const optional      = val(spec.supporting.optionalObjects);
  const decorative    = val(spec.supporting.decorativeElements);
  // Phase 10.4H — activated:
  const subjectRel    = val(spec.supporting.subjectRelationships);
  const relScale      = val(spec.supporting.relativeScale);
  const trustObjs     = val(spec.supporting.trustObjects);
  const eduObjs       = val(spec.supporting.educationalObjects);
  const brandObjs     = val(spec.supporting.brandObjects);
  const icons         = val(spec.supporting.iconElements);
  const infographics  = val(spec.supporting.infographicElements);
  const features      = val(spec.supporting.featuresSection);
  const statistics    = val(spec.supporting.statisticsSection);

  const parts: string[] = [];
  if (subjects)      parts.push(subjects);
  if (subjectRel)    parts.push(`Subject relationship: ${subjectRel}`);
  if (relScale)      parts.push(`Relative scale: ${relScale}`);
  if (relationships) parts.push(`Spatial and narrative relationships: ${relationships}`);
  if (required)      parts.push(`Required elements: ${required}`);
  if (optional)      parts.push(`Optional enrichments: ${optional}`);
  if (decorative)    parts.push(`Decorative layer: ${decorative}`);
  if (trustObjs)     parts.push(`Trust objects (visible credibility): ${trustObjs}`);
  if (eduObjs)       parts.push(`Educational objects (explains process): ${eduObjs}`);
  if (brandObjs)     parts.push(`Brand objects: ${brandObjs}`);
  if (icons)         parts.push(`Icon elements: ${icons}`);
  if (infographics)  parts.push(`Infographic elements: ${infographics}`);
  if (features)      parts.push(`Features display: ${features}`);
  if (statistics)    parts.push(`Statistics display: ${statistics}`);

  return parts.filter(Boolean).join(". ");
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND — Layered Environment
// Never "Restaurant." Always: open kitchen, sommelier, chef pass, birthday
// table, private dining room, window rain, candlelight.
// Reads: environmentType, storyContext, premiumDetails, foreground (was dead
// in old buildEnvironmentSection ordering), midground, background,
// negativeSpace (was dead).
// ─────────────────────────────────────────────────────────────────────────────

export function buildEnvironmentSection(spec: PromptSpecification): string {
  const envType        = val(spec.environment.environmentType);
  const story          = val(spec.environment.storyContext);
  const premium        = val(spec.environment.premiumDetails);
  const foreground     = val(spec.composition.foreground);
  const midground      = val(spec.composition.midground);
  const background     = val(spec.composition.background);
  const negSpace       = val(spec.composition.negativeSpace);
  // Phase 10.4H — activated:
  const storyNarrative = val(spec.mission.storyNarrative);

  const parts: string[] = [];
  if (storyNarrative) parts.push(`Visual narrative: ${storyNarrative}`);
  if (envType)    parts.push(`Setting: ${envType}`);
  if (story)      parts.push(story);
  if (foreground) parts.push(`Foreground: ${foreground}`);
  if (midground)  parts.push(`Midground: ${midground}`);
  if (background) parts.push(`Background: ${background}`);
  if (premium)    parts.push(premium);
  if (negSpace)   parts.push(`Negative space purpose: ${negSpace}`);

  return parts.filter(Boolean).join(". ");
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVERTISEMENT LAYERS
// The complete zone structure — preserved entirely, never extracted or trimmed.
// The opening archetype label AND the zone structure below it both matter.
// Also reads: relationships (was dead), decorativeElements (was dead).
// ─────────────────────────────────────────────────────────────────────────────

export function buildSupportingSection(spec: PromptSpecification): string {
  const adLayers      = val(spec.supporting.advertisementLayers);
  const subjects      = val(spec.supporting.supportingSubjects);
  const relationships = val(spec.supporting.relationships);
  const required      = val(spec.supporting.requiredObjects);
  const optional      = val(spec.supporting.optionalObjects);
  const decorative    = val(spec.supporting.decorativeElements);
  // Phase 10.4H — activated:
  const offerSection  = val(spec.supporting.offerSection);

  if (adLayers && adLayers.length > 20) {
    // Preserve the ENTIRE advertisementLayers value — never strip the opening.
    const extras: string[] = [];
    if (relationships && !adLayers.includes(relationships.slice(0, 40)))
      extras.push(`Scene relationships: ${relationships}`);
    if (decorative && !adLayers.includes(decorative.slice(0, 40)))
      extras.push(`Decorative elements: ${decorative}`);
    if (offerSection && !adLayers.includes(offerSection.slice(0, 40)))
      extras.push(`Offer display: ${offerSection}`);
    return extras.length ? `${adLayers}\n\n${extras.join(". ")}` : adLayers;
  }

  // Fallback when no advertisementLayers — use all supporting fields
  const parts: string[] = [];
  if (subjects)      parts.push(subjects);
  if (relationships) parts.push(`Relationships: ${relationships}`);
  if (required)      parts.push(`Required elements: ${required}`);
  if (optional)      parts.push(`Optional elements: ${optional}`);
  if (decorative)    parts.push(`Decorative elements: ${decorative}`);
  if (offerSection)  parts.push(`Offer display: ${offerSection}`);

  return parts.filter(Boolean).join(". ");
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA
// Full composition + camera storytelling — never omit any field.
// Now reads: cameraHeight (was dead), perspectiveIntent (was dead),
//            negativeSpace (was dead from camera section perspective).
// ─────────────────────────────────────────────────────────────────────────────

export function buildCompositionCameraSection(spec: PromptSpecification): string {
  const comp        = val(spec.composition.primaryComposition);
  const balance     = val(spec.composition.visualBalance);
  const depth       = val(spec.composition.depthTreatment);
  const negSpace    = val(spec.composition.negativeSpace);
  const camPos      = val(spec.camera.cameraPosition);
  const camHeight   = val(spec.camera.cameraHeight);
  const camAngle    = val(spec.camera.viewingAngle);
  const lens        = val(spec.camera.lensIntent);
  const dist        = val(spec.camera.distance);
  const perspective = val(spec.camera.perspectiveIntent);
  // Phase 10.4H — activated:
  const secondary   = val(spec.composition.secondaryComposition);
  const symmetry    = val(spec.composition.symmetry);
  const eyeFlow     = val(spec.composition.eyeFlow);

  const parts: string[] = [];
  if (comp)      parts.push(`${expand(comp)} composition`);
  if (secondary) parts.push(`Secondary device: ${secondary}`);
  if (balance)   parts.push(`${expand(balance)} visual balance`);
  if (symmetry)  parts.push(`Symmetry: ${expand(symmetry)}`);
  if (eyeFlow)   parts.push(`Eye flow: ${expand(eyeFlow)}`);
  if (depth)     parts.push(expand(depth));
  if (negSpace)  parts.push(`Negative space: ${negSpace}`);

  const camParts = [camPos, camAngle, camHeight].filter(Boolean).map(expand);
  if (camParts.length) parts.push(`Camera: ${camParts.join(", ")}`);
  if (lens)        parts.push(`Lens: ${lens}`);
  if (dist)        parts.push(`${expand(dist)} distance`);
  if (perspective) parts.push(perspective);

  return [...new Set(parts.filter(Boolean))].join(". ");
}

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTING
// Already reads all 5 fields. Now formats as narrative prose, not a comma list.
// ─────────────────────────────────────────────────────────────────────────────

export function buildLightingSection(spec: PromptSpecification): string {
  const primary   = val(spec.lighting.primaryLighting);
  const secondary = val(spec.lighting.secondaryLighting);
  const mood      = val(spec.lighting.moodLighting);
  const shadow    = val(spec.lighting.shadowStyle);
  const reflect   = val(spec.lighting.reflectionStyle);
  // Phase 10.4H — activated:
  const camMood   = val(spec.lighting.cameraMood);
  return [primary, secondary, mood, shadow, reflect, camMood && `Photographic mood: ${camMood}`]
    .filter(Boolean).join(". ");
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKETING INTENT
// All 9 fields. Never brief. Never reduce.
// Campaign, emotion, identity, trust, conversion, psychology — every dimension.
// Now reads: marketingGoal (was dead), trustStrategy (was dead),
//            conversionIntent (was dead), experienceType (was dead).
// The `brief` parameter is DEPRECATED — both true and false return full output.
// ─────────────────────────────────────────────────────────────────────────────

export function buildMarketingSection(spec: PromptSpecification, _brief = false): string {
  const goal          = val(spec.marketing.campaignGoal);
  const marketingGoal = val(spec.marketing.marketingGoal);
  const audience      = val(spec.marketing.targetAudience);
  const emotion       = val(spec.marketing.emotionalGoal);
  const trust         = val(spec.marketing.trustStrategy);
  const conversion    = val(spec.marketing.conversionIntent);
  const expCore       = val(spec.marketing.experienceEmotionalCore);
  const expVisual     = val(spec.marketing.experienceVisualImplication);
  const expType       = val(spec.marketing.experienceType);
  // Phase 10.4H — activated:
  const coreMsg       = val(spec.marketing.coreMessage);
  const custPromise   = val(spec.marketing.customerPromise);
  const valueProp     = val(spec.marketing.valueProposition);
  const urgency       = val(spec.marketing.urgencySignal);
  const visTone       = val(spec.marketing.visualTone);
  const usp           = val(spec.marketing.uniqueSellingPoint);
  const attention     = val(spec.marketing.attentionStrategy);
  const supporting    = val(spec.marketing.supportingMessages);

  const parts: string[] = [];
  if (goal)          parts.push(`Campaign: ${goal}`);
  if (marketingGoal) parts.push(`Marketing goal: ${marketingGoal}`);
  if (coreMsg)       parts.push(`Core message: ${coreMsg}`);
  if (custPromise)   parts.push(`Brand promise: ${custPromise}`);
  if (valueProp)     parts.push(`Value proposition: ${valueProp}`);
  if (usp)           parts.push(`Unique selling point: ${usp}`);
  if (audience)      parts.push(`Audience: ${audience}`);
  if (emotion)       parts.push(`Emotional intent: ${emotion}`);
  if (visTone)       parts.push(`Visual tone: ${visTone}`);
  if (attention)     parts.push(`Attention mechanism: ${attention}`);
  if (urgency)       parts.push(`Urgency signal: ${urgency}`);
  if (supporting)    parts.push(`Supporting messages: ${supporting}`);
  if (trust)         parts.push(`Trust: ${trust}`);
  if (conversion)    parts.push(`Conversion: ${conversion}`);
  if (expCore)       parts.push(`The viewer must feel: ${expCore}`);
  if (expVisual)     parts.push(`The visual must evoke: ${expVisual}`);
  if (expType)       parts.push(`Experience type: ${expType}`);

  return parts.filter(Boolean).join(". ");
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY ZONES
// All 6 zones — reservedBodyArea and reservedDisclaimerArea were dead before.
// ─────────────────────────────────────────────────────────────────────────────

export function buildTypographySection(spec: PromptSpecification): string {
  const headline   = val(spec.typography.reservedHeadlineArea);
  const body       = val(spec.typography.reservedBodyArea);       // was dead
  const cta        = val(spec.typography.reservedCtaArea);
  const logo       = val(spec.typography.reservedLogoArea);
  const disclaimer = val(spec.typography.reservedDisclaimerArea); // was dead
  const platform   = val(spec.typography.platformTextSafetyNote);
  return [headline, body, cta, logo, disclaimer, platform].filter(Boolean).join(". ");
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVERTISEMENT INTENT (mission opener)
// Preserve the complete mission brief — never truncate to first sentence.
// ─────────────────────────────────────────────────────────────────────────────

export function buildAdvertisementIntentSection(spec: PromptSpecification): string {
  const whatToGenerate = val(spec.mission.whatToGenerate);
  if (whatToGenerate && whatToGenerate.length > 10) return whatToGenerate;
  // Fallback: first line of advertisementLayers (archetype label)
  const adLayers = val(spec.supporting.advertisementLayers);
  if (adLayers && adLayers.length > 10) {
    return adLayers.split("\n")[0]?.trim() ?? "";
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// STORY CONTEXT — Advertisement Intelligence Narrative (Phase 10.4J)
// Converts invisible marketing signals into specific visible scene directives.
// Must appear before PRIMARY HERO so the model has narrative intent first.
// ─────────────────────────────────────────────────────────────────────────────

// [prompt-bloat fix] Trimmed to the two fields that describe what's actually
// staged/visible in the shot. Dropped, verified non-visual against real
// output (not assumed): proofElement/objectionCounter ("Credibility
// visible:"/"Objection handled visually:" — sales-objection framing, not a
// scene description), identitySignal (describes the target customer's belief
// system, e.g. "A person who believes X — and has decided to do something
// about it" — never anything in frame), urgencyVisual (marketing urgency
// concept), conversionMoment (a hypothetical viewer's internal thought, e.g.
// "The viewer thinks: this is who I want doing this for me" — the same
// non-visual pattern as conversionIntent above), and enrichmentTags (raw
// internal enum labels dumped as prose, e.g. "expert_in_action,
// process_visible" — not natural language at all). All of this data is
// still on spec.advertisementNarrative for the blueprint/trace — only
// excluded from this string.
export function buildAdNarrativeSection(spec: PromptSpecification): string {
  const ad = spec.advertisementNarrative;
  if (!ad) return "";

  const parts: string[] = [ad.storyScenario, ad.emotionalMoment];

  return parts.filter(Boolean).join(". ");
}

/**
 * Returns a compact comma-separated enrichment tag string for tag-style translators (Flux, SDXL).
 * Returns "" when no narrative is present.
 */
export function buildAdNarrativeTags(spec: PromptSpecification): string {
  const ad = spec.advertisementNarrative;
  if (!ad || ad.enrichmentTags.length === 0) return "";
  // Include storyArchetype as first tag for context, then enrichment tags
  return [ad.storyArchetype.replace(/_/g, " "), ...ad.enrichmentTags].join(", ");
}

// ─────────────────────────────────────────────────────────────────────────────
// NEGATIVES — Merged Intelligently
// Reads all 4 negativeConstraints fields + brandRules.forbiddenElements (was dead).
// Deduplicates without losing meaning.
// ─────────────────────────────────────────────────────────────────────────────

export function getNegatives(optimized: OptimizedPromptSpecification): string {
  const merged = optimized.mergedNegatives.consolidated;
  if (merged && merged.length > 5) return merged;

  const spec = optimized.optimizedSpec;
  const raw = [
    val(spec.negativeConstraints.forbiddenSceneElements),
    val(spec.negativeConstraints.forbiddenAiArtifacts),
    val(spec.negativeConstraints.qualityAntiPatterns),
    val(spec.negativeConstraints.brandAntiPatterns),
    val(spec.brandRules.forbiddenElements), // was dead
  ].filter(Boolean).join(", ");

  // Deduplicate
  const tokens = raw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return [...new Set(tokens)].join(", ");
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERING DIRECTIVE
// All 6 rendering fields — commercialQuality, editorialQuality, luxuryLevel,
// and artifactPrevention were all dead before.
// ─────────────────────────────────────────────────────────────────────────────

export function getRenderingDirective(optimized: OptimizedPromptSpecification): string {
  const dir = optimized.optimizedRendering.combinedDirective;
  if (dir && dir !== "unknown" && dir.length > 10) return dir;

  const spec = optimized.optimizedSpec;
  const parts: string[] = [];

  const photorealism    = val(spec.rendering.photorealismLevel);
  const commercial      = val(spec.rendering.commercialQuality);
  const editorial       = val(spec.rendering.editorialQuality);
  const luxury          = val(spec.rendering.luxuryLevel);
  const realism         = val(spec.rendering.realismTarget);
  const artifacts       = val(spec.rendering.artifactPrevention);
  // Phase 10.4H — activated:
  const designStyle     = val(spec.rendering.overallDesignStyle);
  const visualArchetype = val(spec.rendering.visualArchetype);

  if (designStyle)      parts.push(`Design direction: ${designStyle}`);
  if (visualArchetype)  parts.push(`Visual archetype: ${visualArchetype}`);
  if (photorealism)     parts.push(expand(photorealism));
  if (commercial)       parts.push(expand(commercial));
  if (editorial)        parts.push(expand(editorial));
  if (luxury)           parts.push(expand(luxury));
  if (realism)          parts.push(expand(realism));
  if (artifacts)        parts.push(`Actively prevent: ${artifacts}`);

  return parts.filter(Boolean).join(". ");
}
