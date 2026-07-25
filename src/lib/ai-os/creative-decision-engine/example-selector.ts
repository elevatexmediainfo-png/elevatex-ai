// Phase 8.5 — Example Selector.
//
// Selects 3–5 most relevant goldStandard examples from a CKL campaign.
// Replaces the old approach of dumping all 12 principle goldStandards.
// Criteria: top-N by industry priority weight + always include
// marketingPsychology and antiPattern.

import type { CampaignKnowledge, QualityExample } from "../creative-knowledge-library/types";
import type { IndustryDecisionProfile } from "./types";

const ALWAYS_INCLUDE  = ["marketingPsychology", "antiPattern"] as const;
const MAX_EXAMPLES    = 5;

type CKLField = keyof CampaignKnowledge;

function isQualityExample(value: unknown): value is QualityExample {
  return (
    typeof value === "object" &&
    value !== null &&
    "goldStandard" in value &&
    typeof (value as QualityExample).goldStandard === "string"
  );
}

export interface SelectedExample {
  dimension:  string;
  priority:   number;
  mandatory:  boolean;
  goldStandard: string;
  whyBad?:    string;  // included for antiPattern
  bad?:       string;  // included for antiPattern
}

/**
 * Returns the 3–5 most relevant goldStandard examples from a CKL campaign,
 * ranked by the industry's priority weights.
 */
export function selectRelevantExamples(
  campaign: CampaignKnowledge,
  profile:  IndustryDecisionProfile,
): SelectedExample[] {
  // Sort all priorities descending, excluding the always-included dimensions
  const alwaysSet = new Set<string>(ALWAYS_INCLUDE);

  const ranked = [...profile.priorities]
    .filter(p => !alwaysSet.has(p.dimension))
    .sort((a, b) => b.priority - a.priority);

  // Take top (MAX_EXAMPLES - always count) variable dimensions
  const varSlots = MAX_EXAMPLES - ALWAYS_INCLUDE.length;
  const topDimensions = ranked.slice(0, varSlots).map(p => p.dimension);

  const allDimensions = [...topDimensions, ...ALWAYS_INCLUDE];
  const results: SelectedExample[] = [];

  for (const dim of allDimensions) {
    const fieldValue = campaign[dim as CKLField];
    if (!isQualityExample(fieldValue)) continue;

    const profileEntry = profile.priorities.find(p => p.dimension === dim);
    const example: SelectedExample = {
      dimension:   dim,
      priority:    profileEntry?.priority ?? 5,
      mandatory:   profileEntry?.mandatory ?? false,
      goldStandard: fieldValue.goldStandard,
    };

    if (dim === "antiPattern") {
      example.bad    = fieldValue.bad;
      example.whyBad = fieldValue.whyBad;
    }

    results.push(example);
  }

  return results;
}
