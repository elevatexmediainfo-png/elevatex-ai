import type { SceneGraph } from "./types";
import {
  HEAD_DIRECTION_PHRASE, EYE_DIRECTION_PHRASE, SHOULDER_ANGLE_PHRASE,
} from "./vocabulary";

export type SceneGraphDomains = Omit<SceneGraph, "narrative" | "meta">;

// Phase 10.6B — Narrative renderer.
// "Generate Scene Graph first. Narrative later... Scene Graph owns the
// photograph. Prompt owns only the wording." This function is the only place
// in the module that turns the graph into prose — every sentence pulls its
// content from a SceneGraph field already computed by a builder; nothing
// here invents new scene content. Fields whose value is "not_applicable" are
// skipped, not printed, so the paragraph never reads "no animals present."
//
// Sentence order is fixed (hero+pose+hands, body detail, supporting
// subjects, environment, materials, micro-motion, camera) because a
// photograph description reads coherently subject-first, environment-second,
// finish-detail-last — reordering it per campaign would not add real
// diversity, only incoherence. The combinatorial diversity this module is
// judged on lives in the WORD CHOICES inside each sentence (every builder's
// independent seeded axes), not in shuffling sentence position.

const TEMPORAL_PHRASE: Record<string, string> = {
  mid_gesture:          "the frame catching the scene mid-gesture",
  peak_action:          "the frame catching the peak of the action",
  just_before_contact:  "the frame catching the instant just before contact",
  just_after_release:   "the frame catching the moment just after release",
  suspended_mid_motion: "the frame catching a moment suspended mid-motion",
};

function cap(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function period(s: string): string {
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

export function renderNarrative(graph: SceneGraphDomains): string {
  const { who, where, pose, body, objectContact, microMotion, camera, materials } = graph;
  const sentences: string[] = [];

  // 1. Hero, pose, hands.
  sentences.push(period(cap(`${who.primaryHero.value}, ${pose.secondaryAction.value}, ${body.handPosition.value}`)));

  // 2. Body detail.
  const headPhrase = HEAD_DIRECTION_PHRASE[body.headDirection.value] ?? "head oriented naturally";
  const eyePhrase = EYE_DIRECTION_PHRASE[body.eyeDirection.value] ?? "gaze settled naturally";
  const shoulderPhrase = SHOULDER_ANGLE_PHRASE[body.shoulderAngle.value] ?? "shoulders relaxed";
  sentences.push(period(cap(`${headPhrase}, ${eyePhrase}, ${shoulderPhrase}`)));

  // 3. Supporting subjects + secondary contact + animals/vehicles.
  const supportingClauses: string[] = [];
  if (who.supportingPeople.value !== "not_applicable" && who.supportingPeople.value !== "unknown") {
    supportingClauses.push(who.supportingPeople.value);
  }
  if (objectContact.secondaryContact.value !== "not_applicable" && objectContact.secondaryContact.value !== "unknown") {
    supportingClauses.push(objectContact.secondaryContact.value);
  }
  if (who.animals.value !== "not_applicable" && who.animals.value !== "unknown") supportingClauses.push(who.animals.value);
  if (who.vehicles.value !== "not_applicable" && who.vehicles.value !== "unknown") supportingClauses.push(who.vehicles.value);
  if (supportingClauses.length > 0) sentences.push(period(cap(supportingClauses.join("; "))));

  // 4. Environment — architecture, spatial context, furniture.
  const spatialContext = [where.room, where.street, where.landscape].find((f) => f.value !== "not_applicable" && f.value !== "unknown");
  const envClause = spatialContext
    ? `${cap(where.architecture.value)} frames ${spatialContext.value}, ${where.furniture.value} anchoring the space`
    : `${cap(where.architecture.value)} frames the space, ${where.furniture.value} anchoring it`;
  sentences.push(period(envClause));

  // 5. Materials.
  sentences.push(period(cap(`the surface is ${materials.surfaceMaterial.value}, and ${materials.reflection.value}`)));
  sentences.push(period(cap(`${materials.objectMaterial.value}, set against ${materials.fabricMaterial.value}`)));

  // 6. Micro motion + temporal instant.
  const temporalPhrase = TEMPORAL_PHRASE[microMotion.temporalInstant.value] ?? "the frame catching a single decisive instant";
  sentences.push(period(cap(`${microMotion.elements.value}, ${temporalPhrase}`)));

  // 7. Camera. "the eye follows" (not "{leadingLines} lead/leads") keeps
  // subject-verb agreement correct regardless of whether the chosen leading-
  // line source is singular ("the counter edge") or plural ("the corridor walls").
  sentences.push(period(cap(`shot at ${camera.height.value}, ${camera.distance.value}, ${camera.perspective.value}; the eye follows ${camera.leadingLines.value} through the frame, and ${camera.occlusion.value}`)));

  return sentences.join(" ");
}
