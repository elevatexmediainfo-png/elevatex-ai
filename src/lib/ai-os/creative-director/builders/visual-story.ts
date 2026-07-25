import type { CreativeStrategy } from "../../creative-brain/types";
import type { VisualStory } from "../types";
import { cf, unknownCf } from "./shared";

// Builder 2 — Visual Story
// Sole responsibility: design the narrative arc the visuals tell.
// Reads: strategy.creative, strategy.visual, strategy.communication, strategy.campaign
// Never generates prompts or copy.

const OPENING_SCENES: Record<string, Record<string, string>> = {
  dental: {
    before_after:      "The visual opens on the unforgettable contrast: a dull, unhappy smile on one side and a radiant, confident result on the other — the transformation is the opening argument",
    informative:       "A confident patient mid-consultation, engaged and informed, inside a clean modern clinic — trust communicated before a word is read",
    lead_generation:   "A warm, natural smile that radiates confidence — the viewer immediately wants what this person has",
  },
  healthcare: {
    awareness:         "A caring healthcare professional in a modern, welcoming clinic — the opening establishes safety and competence simultaneously",
    lead_generation:   "A reassured patient leaving a consultation — the story starts at the positive outcome, then works backward",
  },
  food_beverage: {
    awareness:         "The hero dish, close enough to read every texture and glisten — appetite is activated in the first fraction of a second",
    event_announcement:"The restaurant's defining visual moment: atmosphere, signature dish, and the energy of people enjoying it",
  },
  real_estate: {
    awareness:         "The property's defining architectural feature at golden hour — scale, aspiration, and lifestyle communicated without a single word",
    lead_generation:   "An outdoor living scene that makes the viewer think 'this is exactly how I want to live'",
  },
  finance: {
    education:         "A visual metaphor for growth — upward momentum rendered tastefully, not as a cliché chart but as a lived lifestyle",
    lead_generation:   "A composed professional reviewing their financial plan with quiet confidence — the viewer sees themselves",
  },
  education: {
    lead_generation:   "Energetic students in an active learning environment — the opening communicates potential and possibility",
    awareness:         "A proud achievement moment: graduation, award, or accomplishment that triggers parental aspiration",
  },
  beauty_wellness: {
    before_after:      "The before/after split opens immediately — the transformation is the headline, the story, and the hook all in one visual",
    awareness:         "A close-up of genuinely healthy, radiant hair or skin — the texture and quality do the selling",
  },
  jewellery_luxury: {
    sales:             "The hero piece, lit to reveal every facet — the opening is a reverent macro moment that communicates craftsmanship",
    awareness:         "A lifestyle scene where the piece naturally commands attention — luxury as a way of living, not just wearing",
  },
};

const EMOTIONAL_JOURNEYS: Record<string, string> = {
  awareness:       "Curiosity → Intrigue → Desire → Brand Recognition",
  lead_generation: "Recognition of Need → Hope → Trust → Action Impulse",
  sales:           "Desire → Value Confirmation → Trust → Decisive Action",
  education:       "Confusion or Uncertainty → Clarity → Confidence → Committed Action",
  trust:           "Doubt or Hesitation → Recognition → Reassurance → Committed Trust",
  engagement:      "Emotional Connection → Identification → Sharing Impulse → Brand Affinity",
  before_after:    "Recognition of Pain → Hope for Change → Transformation Proof → Personal Desire",
  event:           "Excitement → FOMO → Conviction → Immediate Action to Reserve/Attend",
};

export function buildVisualStory(strategy: CreativeStrategy): VisualStory {
  const industryKey = strategy.business.subIndustry.value !== "unknown"
    ? strategy.business.subIndustry.value
    : strategy.business.industry.value;
  const campaignGoal = strategy.marketing.campaignGoal.value;

  const openingScene = (() => {
    const industryScenes = OPENING_SCENES[industryKey ?? ""] ?? OPENING_SCENES[strategy.business.industry.value ?? ""] ?? {};
    const specific = industryScenes[campaignGoal ?? ""] ?? industryScenes[strategy.campaign.campaignCategory.value ?? ""];
    if (specific) return cf(specific, "high", `Opening scene designed for industry="${industryKey}" × goal="${campaignGoal}"`);
    const heroSubject = strategy.creative.heroSubject.value;
    if (heroSubject !== "unknown") {
      return cf(`The creative opens on: ${heroSubject}`, "medium",
        `Opening scene derived from Creative Brain hero subject decision`);
    }
    return unknownCf("openingScene");
  })();

  const heroMoment = (() => {
    const hero = strategy.creative.heroSubject.value;
    const focus = strategy.creative.focusPriority.value;
    if (focus === "transformation") {
      return cf("The transformation reveal — the before/after split or progression that makes the result undeniable", "high",
        `Transformation focus → hero moment is the reveal of change`);
    }
    if (focus === "emotion") {
      return cf("The human emotional peak — the moment a real person's face communicates the outcome better than any claim", "high",
        `Emotion focus → hero moment is the authentic human reaction to the result`);
    }
    if (focus === "product" && hero !== "unknown") {
      return cf(`The product at its most compelling: ${hero}`, "medium",
        `Product focus → hero moment showcases the product at maximum impact`);
    }
    if (hero !== "unknown") {
      return cf(`${hero} — captured at the moment the message is clearest`, "medium",
        `Hero moment derived from Creative Brain hero subject`);
    }
    return unknownCf("heroMoment");
  })();

  const supportingStory = (() => {
    const supports = strategy.creative.supportingSubjects.value;
    if (supports !== "unknown") {
      return cf(`Supporting narrative: ${supports} — each element reinforces without competing`, "medium",
        `Supporting elements from Creative Brain knowledge bank guide the secondary story`);
    }
    return unknownCf("supportingStory");
  })();

  const endingImpression = (() => {
    const goal = campaignGoal;
    const impressions: Record<string, string> = {
      lead_generation: "The viewer leaves with a clear mental image of how their life improves after taking action — and a specific next step in mind",
      sales:           "A feeling of 'I need this now' combined with the confidence that this is the right choice",
      education:       "Informed confidence — the viewer understands something they didn't before and trusts the source",
      trust:           "The quiet certainty that this brand is the right choice — no doubts remain",
      awareness:       "Memorability — the campaign theme lives in the mind long after the creative is gone",
      engagement:      "Emotional resonance that makes the viewer want to share the experience",
    };
    const val = impressions[goal ?? ""];
    if (val) return cf(val, "high", `Ending impression engineered for campaign goal="${goal}"`);
    return unknownCf("endingImpression");
  })();

  const emotionalJourney = (() => {
    const journey = EMOTIONAL_JOURNEYS[campaignGoal ?? ""]
      ?? EMOTIONAL_JOURNEYS[strategy.campaign.campaignCategory.value ?? ""];
    if (journey) return cf(journey, "high", `Emotional arc mapped from campaignGoal="${campaignGoal}"`);
    return unknownCf("emotionalJourney");
  })();

  const visualNarrative = (() => {
    const theme = strategy.marketing.campaignGoal.value;
    const narrative = theme !== "unknown"
      ? `A ${theme} story told visually: ${openingScene.value !== "unknown" ? "opens on the core tension or aspiration" : "establishes the campaign context"}, builds to the ${heroMoment.value !== "unknown" ? "hero moment" : "primary message"}, and resolves in ${endingImpression.value !== "unknown" ? "clear conviction" : "brand affinity"}`
      : "unknown";
    if (narrative !== "unknown") return cf(narrative, "medium", `Complete visual narrative synthesized from all story components`);
    return unknownCf("visualNarrative");
  })();

  return { openingScene, heroMoment, supportingStory, endingImpression, emotionalJourney, visualNarrative };
}
