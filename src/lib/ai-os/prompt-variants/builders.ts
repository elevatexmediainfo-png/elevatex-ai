// Phase 6 — Prompt Variant Builders.
//
// All 4 variants derive from the SAME GPTCampaignDirection object.
// The only difference is the ordering and emphasis of its fields.
//
// FROZEN MODULES: none of the imported modules are modified.
// Variant A delegates to the production buildNarrativePrompt().
// Variants B/C/D reorder the same fields locally.

import type { GPTCampaignDirection } from "../creative-director/gpt-types";
import { buildNarrativePrompt } from "../prompt-spec/gpt-narrative";
import type { BuiltVariant, VariantType } from "./types";
import { VARIANT_FOCUS, VARIANT_LABELS } from "./types";

// ─── Local helpers (mirrors gpt-narrative.ts — not exported from that module)

function isPresent(v: string | undefined | null): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function hasItems(arr: string[] | undefined): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

function buildSentences(dir: GPTCampaignDirection, builders: Array<(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) => void>): string {
  const sentences: string[] = [];
  const add = (s: string | undefined | null) => {
    if (s && s.trim()) sentences.push(s.trim());
  };
  for (const fn of builders) fn(dir, add);
  return sentences.join(" ");
}

// ─── Reusable field emitters ────────────────────────────────────────────────

function emitCampaignConcept(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (isPresent(d.campaignConcept)) add(d.campaignConcept);
}
function emitViewerEmotion(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (isPresent(d.viewerEmotion)) add(`Every visual decision in this image exists to make the viewer feel ${d.viewerEmotion}.`);
}
function emitMarketingObjective(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (isPresent(d.marketingObjective)) add(d.marketingObjective);
}
function emitCoreMessage(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (isPresent(d.coreMessage)) add(`Above all, this image must communicate: ${d.coreMessage}`);
}
function emitPsychologicalGoal(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (isPresent(d.psychologicalGoal)) add(d.psychologicalGoal);
}
function emitSceneDescription(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  add(d.sceneDescription);
}
function emitHeroSubject(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (isPresent(d.heroSubject)) add(d.heroSubject);
}
function emitSecondarySubjects(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (isPresent(d.secondarySubjects)) add(d.secondarySubjects);
}
function emitSupportingObjects(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (isPresent(d.supportingObjects)) add(d.supportingObjects);
}
function emitCompositionIntent(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (d.compositionIntent) {
    if (isPresent(d.compositionIntent.eyeFlow))        add(d.compositionIntent.eyeFlow);
    if (isPresent(d.compositionIntent.subjectBalance)) add(d.compositionIntent.subjectBalance);
    if (isPresent(d.compositionIntent.framingLogic))   add(d.compositionIntent.framingLogic);
  }
}
function emitVisualHierarchy(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (d.visualHierarchy) {
    if (isPresent(d.visualHierarchy.primary))    add(d.visualHierarchy.primary);
    if (isPresent(d.visualHierarchy.secondary))  add(d.visualHierarchy.secondary);
    if (isPresent(d.visualHierarchy.background)) add(d.visualHierarchy.background);
    if (isPresent(d.visualHierarchy.decorative)) add(d.visualHierarchy.decorative);
  }
}
function emitNegativeSpace(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (d.negativeSpace) {
    if (isPresent(d.negativeSpace.headline)) add(d.negativeSpace.headline);
    if (isPresent(d.negativeSpace.cta))      add(d.negativeSpace.cta);
    if (isPresent(d.negativeSpace.logo))     add(d.negativeSpace.logo);
  }
}
function emitLighting(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (isPresent(d.lightingMood)) add(d.lightingMood);
}
function emitColor(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (isPresent(d.colorPsychology)) add(d.colorPsychology);
}
function emitEnvironment(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (isPresent(d.environment)) add(d.environment);
}
function emitMarketingTriggers(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (hasItems(d.marketingTriggers)) {
    const triggers = [...d.marketingTriggers];
    if (triggers.length === 1) {
      add(`This image activates ${triggers[0]}.`);
    } else {
      const last = triggers.pop()!;
      add(`This image activates ${triggers.join(", ")} and ${last}.`);
    }
  }
}
function emitTrustTriggers(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (hasItems(d.trustTriggers)) {
    d.trustTriggers.forEach(t => { if (t && t.trim()) add(t); });
  }
}
function emitMicroInteractions(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (hasItems(d.microInteractions)) {
    d.microInteractions.forEach(m => { if (m && m.trim()) add(m); });
  }
}
function emitCommercialStyle(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (isPresent(d.commercialStyle)) add(d.commercialStyle);
}
function emitNarrative(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (isPresent(d.narrative)) add(d.narrative);
}
function emitMustInclude(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (hasItems(d.mustInclude)) add(`The image demands the presence of: ${d.mustInclude.join(", ")}.`);
}
function emitMustAvoid(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (hasItems(d.mustAvoid)) add(`This image must never become: ${d.mustAvoid.join(", ")}.`);
}

// Note: add() used in emitVisualStory joins multiple parts — handle via spread
function emitVisualStoryParts(d: GPTCampaignDirection, add: (s: string | undefined | null) => void) {
  if (d.visualStory) {
    const parts = [d.visualStory.before, d.visualStory.moment, d.visualStory.after]
      .filter(p => p && p.trim());
    if (parts.length) add(parts.join(" "));
  }
}

// ─── Variant B — Story-first ─────────────────────────────────────────────────
// Emotion and narrative lead. The viewer's feeling and the story arc arrive
// before the scene description, priming the image model with emotional context.

function buildStoryFirst(dir: GPTCampaignDirection): string {
  return buildSentences(dir, [
    emitViewerEmotion,
    emitNarrative,
    emitCoreMessage,
    emitPsychologicalGoal,
    emitVisualStoryParts,
    emitCampaignConcept,
    emitMarketingObjective,
    emitSceneDescription,
    emitHeroSubject,
    emitSecondarySubjects,
    emitSupportingObjects,
    emitCompositionIntent,
    emitVisualHierarchy,
    emitNegativeSpace,
    emitLighting,
    emitColor,
    emitEnvironment,
    emitMarketingTriggers,
    emitTrustTriggers,
    emitMicroInteractions,
    emitCommercialStyle,
    emitMustInclude,
    emitMustAvoid,
  ]);
}

// ─── Variant C — Composition-first ───────────────────────────────────────────
// Visual arrangement leads. Scene, eye flow, hierarchy, and breathing room
// arrive first so the image model builds the spatial structure before the
// emotional and commercial context is added on top.

function buildCompositionFirst(dir: GPTCampaignDirection): string {
  return buildSentences(dir, [
    emitSceneDescription,
    emitCompositionIntent,
    emitVisualHierarchy,
    emitNegativeSpace,
    emitLighting,
    emitColor,
    emitEnvironment,
    emitHeroSubject,
    emitSecondarySubjects,
    emitSupportingObjects,
    emitVisualStoryParts,
    emitPsychologicalGoal,
    emitViewerEmotion,
    emitCampaignConcept,
    emitMarketingObjective,
    emitMarketingTriggers,
    emitCoreMessage,
    emitTrustTriggers,
    emitMicroInteractions,
    emitCommercialStyle,
    emitNarrative,
    emitMustInclude,
    emitMustAvoid,
  ]);
}

// ─── Variant D — Marketing-first ─────────────────────────────────────────────
// Commercial mandate leads. Campaign concept, objective, triggers, and core
// message arrive before the scene — the image model understands the commercial
// purpose before it sees what to depict.

function buildMarketingFirst(dir: GPTCampaignDirection): string {
  return buildSentences(dir, [
    emitCampaignConcept,
    emitMarketingObjective,
    emitCoreMessage,
    emitMarketingTriggers,
    emitViewerEmotion,
    emitPsychologicalGoal,
    emitSceneDescription,
    emitHeroSubject,
    emitVisualStoryParts,
    emitSecondarySubjects,
    emitSupportingObjects,
    emitCompositionIntent,
    emitTrustTriggers,
    emitVisualHierarchy,
    emitLighting,
    emitColor,
    emitEnvironment,
    emitMicroInteractions,
    emitCommercialStyle,
    emitNegativeSpace,
    emitNarrative,
    emitMustInclude,
    emitMustAvoid,
  ]);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Build a single variant narrative from the given GPT Creative Direction. */
export function buildVariantNarrative(type: VariantType, dir: GPTCampaignDirection): string {
  switch (type) {
    case "balanced":          return buildNarrativePrompt(dir); // production function
    case "story_first":       return buildStoryFirst(dir);
    case "composition_first": return buildCompositionFirst(dir);
    case "marketing_first":   return buildMarketingFirst(dir);
  }
}

/** Build all 4 variant narratives from the same GPT Creative Direction. */
export function buildAllVariants(dir: GPTCampaignDirection): BuiltVariant[] {
  const types: VariantType[] = ["balanced", "story_first", "composition_first", "marketing_first"];
  return types.map(type => ({
    type,
    label:     VARIANT_LABELS[type],
    focus:     VARIANT_FOCUS[type],
    narrative: buildVariantNarrative(type, dir),
  }));
}
