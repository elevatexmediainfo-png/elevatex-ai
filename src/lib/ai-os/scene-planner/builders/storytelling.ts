import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { StorytellingPlanning } from "../types";
import { sp, unknownSp } from "./shared";
import type { VTEEnrichment } from "../vte-bridge";

// Builder 9 — Storytelling Planning
// The narrative arc within a single frame.
// Phase 10.5A: VTE enrichment integrated.
// VTE action primitive → middle (the decisive moment).
// VTE composedDirective → singleFrameNarrative synthesis when no campaign narrative exists.

export function buildStorytellingPlanning(bp: UniversalCampaignBlueprint, vte?: VTEEnrichment): StorytellingPlanning {
  const campaign = bp.campaign;
  const strategy = bp.strategy;

  const beginning = (() => {
    const openingScene = campaign.visualStory.openingScene.value;
    if (openingScene !== "unknown") {
      return sp(openingScene.slice(0, 200), "high", `Scene beginning from Campaign Plan Visual Story opening scene`);
    }
    const p1 = bp.layout.visualPriority.priority1.value;
    if (p1 !== "unknown") {
      return sp(`The viewer's eye lands immediately on: ${p1.slice(0, 100)} — this is the visual hook that stops the scroll`, "medium",
        `Beginning derived from layout visual priority 1`);
    }
    return unknownSp("beginning");
  })();

  const middle = (() => {
    const heroMoment = campaign.visualStory.heroMoment.value;
    if (heroMoment !== "unknown") {
      return sp(heroMoment.slice(0, 200), "high", `Scene middle from Campaign Plan Visual Story hero moment`);
    }

    // Phase 10.5A — VTE action primitive IS the decisive moment when the Campaign
    // Plan does not specify one. This is the highest-value VTE injection point:
    // the "middle" of the story is exactly what the hero is DOING in the frame.
    // Receives the VTE action when hero was from Creative Brain (no plan heroMoment),
    // turning a generic "patient with confident smile" into a specific visual moment.
    if (vte?.hasContent && vte.action[0]) {
      return sp(
        vte.action[0].value,
        "high",
        `Scene middle from VTE action primitive — the decisive visual moment for "${vte.resolvedIndustry}" (replaces unknown heroMoment)`
      );
    }

    const supporting = campaign.visualStory.supportingStory.value;
    if (supporting !== "unknown") {
      return sp(supporting.slice(0, 150), "medium", `Scene middle from Campaign Plan Visual Story supporting narrative`);
    }
    return unknownSp("middle");
  })();

  const end = (() => {
    const endingImpression = campaign.visualStory.endingImpression.value;
    if (endingImpression !== "unknown") {
      return sp(endingImpression.slice(0, 200), "high", `Scene end from Campaign Plan Visual Story ending impression`);
    }
    const emotionalHook = campaign.concept.emotionalHook.value as string;
    const endMap: Record<string, string> = {
      trust_and_reassurance:    "The viewer is left with a feeling of certainty — this is the right choice, and they are safe",
      aspiration_and_desire:    "The viewer is left wanting — they see their ideal future self reflected in this image",
      transformation_and_hope:  "The viewer is left believing change is possible — and that this brand is the vehicle for it",
      excitement_and_urgency:   "The viewer is left with momentum — they feel compelled to act before the moment passes",
      authority_and_expertise:  "The viewer is left with confidence — these people know what they're doing",
    };
    const val = endMap[emotionalHook ?? ""] ?? "The viewer is left with a clear, positive impression of the brand and a sense of what to do next";
    return sp(val, "medium", `Scene ending impression from emotional hook "${emotionalHook}"`);
  })();

  const singleFrameNarrative = (() => {
    const visualNarrative = campaign.visualStory.visualNarrative.value;
    if (visualNarrative !== "unknown") {
      return sp(visualNarrative.slice(0, 250), "high", `Single-frame narrative from Campaign Plan complete visual narrative`);
    }

    // Phase 10.5A — VTE composedDirective provides the multi-concept narrative
    // synthesis that the Campaign Plan omitted. Combined with the scene beginning,
    // this produces the "chef pauses while placing the final garnish as a family
    // begins applauding" style of specific, concrete single-frame story.
    if (vte?.hasContent && vte.composedDirective && beginning.value !== "unknown") {
      return sp(
        `${beginning.value.slice(0, 80)} — ${vte.composedDirective.slice(0, 200)}`,
        "high",
        `Single-frame narrative: scene opening enriched with VTE composed directive for "${vte.resolvedIndustry}"`
      );
    }

    // Synthesise from beginning + middle + end
    if (beginning.value !== "unknown" && middle.value !== "unknown") {
      return sp(
        `A scene that opens on ${beginning.value.slice(0, 60)}..., delivers its story through ${middle.value.slice(0, 60)}..., and leaves the viewer ${end.value.slice(0, 60)}`,
        "medium",
        `Single-frame narrative synthesized from scene arc components`
      );
    }
    return unknownSp("singleFrameNarrative");
  })();

  const emotionalArc = (() => {
    const journey = campaign.visualStory.emotionalJourney.value;
    if (journey !== "unknown") {
      return sp(journey, "high", `Emotional arc from Campaign Plan Visual Story emotional journey`);
    }
    const goal = strategy.marketing.campaignGoal.value;
    const arcMap: Record<string, string> = {
      lead_generation: "Recognition of need → Hope for solution → Trust in this provider → Impulse to act",
      awareness:       "Curiosity → Intrigue → Desire → Brand recognition",
      sales:           "Desire → Value confirmation → Trust → Decisive action",
      education:       "Confusion or uncertainty → Clarity → Confidence → Committed action",
      trust:           "Doubt or hesitation → Recognition → Reassurance → Committed trust",
    };
    const val = arcMap[goal ?? ""] ?? "Attention → Interest → Desire → Action";
    return sp(val, goal !== "unknown" ? "medium" : "low", `Emotional arc from campaign goal "${goal}"`);
  })();

  return { beginning, middle, end, singleFrameNarrative, emotionalArc };
}
