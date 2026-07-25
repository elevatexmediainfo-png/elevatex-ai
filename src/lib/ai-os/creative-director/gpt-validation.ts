// Phase 5 — GPT Creative Director schema validation.
// Validates that the JSON returned by GPT matches GPTCampaignDirection exactly.
// Throws a descriptive error if any required field is missing or wrong type.

import type { GPTCampaignDirection } from "./gpt-types";

function str(v: unknown, field: string): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`GPT response: field "${field}" must be a non-empty string, got ${JSON.stringify(v)}`);
  }
  return v.trim();
}

function strArr(v: unknown, field: string): string[] {
  if (!Array.isArray(v) || v.length === 0) {
    throw new Error(`GPT response: field "${field}" must be a non-empty array, got ${JSON.stringify(v)}`);
  }
  v.forEach((item, i) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error(`GPT response: field "${field}[${i}]" must be a non-empty string`);
    }
  });
  return v.map((s: string) => s.trim());
}

function nested<T>(v: unknown, field: string, keys: string[]): T {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`GPT response: field "${field}" must be an object, got ${JSON.stringify(v)}`);
  }
  const obj = v as Record<string, unknown>;
  for (const key of keys) {
    str(obj[key], `${field}.${key}`);
  }
  return obj as unknown as T;
}

export function validateGPTCampaignDirection(raw: unknown): GPTCampaignDirection {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("GPT response is not a JSON object");
  }
  const d = raw as Record<string, unknown>;

  const direction: GPTCampaignDirection = {
    campaignConcept:    str(d.campaignConcept,    "campaignConcept"),
    marketingObjective: str(d.marketingObjective, "marketingObjective"),
    psychologicalGoal:  str(d.psychologicalGoal,  "psychologicalGoal"),
    viewerEmotion:      str(d.viewerEmotion,       "viewerEmotion"),
    coreMessage:        str(d.coreMessage,         "coreMessage"),
    heroSubject:        str(d.heroSubject,         "heroSubject"),
    secondarySubjects:  str(d.secondarySubjects,   "secondarySubjects"),
    supportingObjects:  str(d.supportingObjects,   "supportingObjects"),
    visualStory:        nested(d.visualStory,      "visualStory",      ["before", "moment", "after"]),
    sceneDescription:   str(d.sceneDescription,    "sceneDescription"),
    visualHierarchy:    nested(d.visualHierarchy,  "visualHierarchy",  ["primary", "secondary", "background", "decorative"]),
    negativeSpace:      nested(d.negativeSpace,    "negativeSpace",    ["headline", "cta", "logo"]),
    compositionIntent:  nested(d.compositionIntent,"compositionIntent",["eyeFlow", "subjectBalance", "framingLogic"]),
    lightingMood:       str(d.lightingMood,        "lightingMood"),
    environment:        str(d.environment,         "environment"),
    colorPsychology:    str(d.colorPsychology,     "colorPsychology"),
    marketingTriggers:  strArr(d.marketingTriggers,"marketingTriggers"),
    trustTriggers:      strArr(d.trustTriggers,    "trustTriggers"),
    microInteractions:  strArr(d.microInteractions,"microInteractions"),
    mustInclude:        strArr(d.mustInclude,       "mustInclude"),
    mustAvoid:          strArr(d.mustAvoid,         "mustAvoid"),
    commercialStyle:    str(d.commercialStyle,     "commercialStyle"),
    narrative:          str(d.narrative,           "narrative"),
  };

  return direction;
}
