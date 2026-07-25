import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { HeroSubjectPlanning } from "../types";
import { sp } from "./shared";
import type { VTEEnrichment } from "../vte-bridge";
import { buildHero } from "../hero-fusion";

// Builder 2 — Hero Subject Planning
// Exactly WHO or WHAT is in the centre of this scene.
// Phase 10.5A.1: exactHeroSubject is produced by the Hero Fusion Engine
// (../hero-fusion.ts) — Reference Image / Creative Brain / Experience / VTE /
// Campaign Intelligence / Marketing / Commercial Style are merged there into
// one sentence. This builder still owns the non-prose scene directives below
// (pose, expression, scale, position, importance) — fusion does not touch them.

export function buildHeroSubjectPlanning(bp: UniversalCampaignBlueprint, vte?: VTEEnrichment): HeroSubjectPlanning {
  const strategy = bp.strategy;
  const campaign = bp.campaign;
  const layout = bp.layout;
  const industryKey = strategy.business.subIndustry.value !== "unknown"
    ? strategy.business.subIndustry.value
    : strategy.business.industry.value;

  const exactHeroSubject = (() => {
    const fusion = buildHero(bp, vte);
    return sp(fusion.value, fusion.confidence, fusion.reasoning);
  })();

  // heroPose — from photography style and focus priority
  const heroPose = (() => {
    const photoStyle = strategy.visual.photographyStyle.value;
    const focusPriority = strategy.creative.focusPriority.value;
    if (photoStyle === "before_after") return sp("transformation_split", "high", `Before/after photography style → split pose format`);
    if (photoStyle === "studio_product" || focusPriority === "product") return sp("static_product", "high", `Product-focus photography → static product pose`);
    if (photoStyle === "aerial") return sp("overhead_product", "high", `Aerial photography → overhead perspective`);
    if (focusPriority === "transformation") return sp("transformation_split", "high", `Transformation focus → before/after split pose`);
    if (focusPriority === "emotion" || focusPriority === "person") return sp("seated_engaged", "medium", `Emotion/person focus → natural engaged seated pose for warmth`);
    if (["jewellery_luxury", "fine_jewellery"].includes(industryKey ?? "")) return sp("static_product", "high", `Jewellery → precision static product pose`);
    if (["food_beverage", "restaurant"].includes(industryKey ?? "")) return sp("overhead_product", "medium", `Food photography → overhead or three-quarter angle`);
    return sp("seated_engaged", "low", `Default: warm seated engagement pose for commercial advertising`);
  })();

  // heroExpression — from emotional goal and human presence
  const heroExpression = (() => {
    const humanPresence = strategy.visual.humanPresence.value;
    if (humanPresence === "none") return sp("not_applicable_product", "high", `No human presence in this scene — expression N/A`);
    const emotionalGoal = campaign.concept.emotionalHook.value as string;
    const expressionMap: Record<string, HeroSubjectPlanning["heroExpression"]["value"]> = {
      reassurance:       "warm_genuine_care",
      trust:             "warm_genuine_care",
      aspiration:        "aspirational_gaze",
      transformation:    "transformation_joy",
      hope:              "transformation_joy",
      excitement:        "confident_natural_smile",
      empowerment:       "focused_expertise",
    };
    const val = expressionMap[emotionalGoal ?? ""] ?? "confident_natural_smile";
    return sp(val, emotionalGoal !== "unknown" ? "high" : "medium",
      `Expression "${val}" from emotional goal "${emotionalGoal}"`);
  })();

  // heroScale — from layout block size and campaign format
  const heroScale = (() => {
    const heroBlockPos = layout.blocks.heroBlock.value;
    if (heroBlockPos === "full_canvas_immersive" || heroBlockPos === "upper_half_full_bleed") {
      return sp("two_thirds_dominant", "high", `Full-bleed hero block → hero dominates two-thirds of the canvas`);
    }
    if (heroBlockPos === "center_dominant") return sp("full_frame_dominant", "high", `Center-dominant block → hero fills the frame`);
    if (heroBlockPos === "left_half_split" || heroBlockPos === "right_half_split") {
      return sp("half_frame", "high", `Split block format → hero occupies exactly half the canvas`);
    }
    if (["jewellery_luxury", "fine_jewellery"].includes(industryKey ?? "")) {
      return sp("full_frame_dominant", "high", `Jewellery → product fills the frame to reveal craftsmanship detail`);
    }
    return sp("two_thirds_dominant", "medium", `Default: hero occupies two-thirds of the frame — dominant but with context room`);
  })();

  // heroPosition — from composition and layout
  const heroPosition = (() => {
    const primaryComp = layout.composition.ruleOfThirds.value;
    const balance = layout.grid.balance.value;
    if (primaryComp === "intentionally_broken") return sp("center_frame", "high", `Rule of thirds intentionally broken → centred for directness`);
    if (balance === "asymmetric_left_heavy") return sp("left_third", "high", `Left-heavy balance → hero in left third`);
    if (balance === "asymmetric_right_heavy") return sp("right_third", "medium", `Right-heavy balance → hero in right third`);
    if (["jewellery_luxury", "fine_jewellery"].includes(industryKey ?? "")) {
      return sp("center_frame", "high", `Luxury jewellery → centred for reverence and focus`);
    }
    return sp("left_third", "medium", `Default: hero in left third with reading space on right — strongest Western composition convention`);
  })();

  // heroImportance — how critical the hero is
  const heroImportance = (() => {
    const density = strategy.creative.informationDensity.value;
    if (density === "single_message") return sp("the_entire_message", "high", `Single message density → hero IS the entire campaign message`);
    if (strategy.creative.focusPriority.value === "product") return sp("the_entire_message", "high", `Product focus → product's beauty IS the argument`);
    return sp("primary_anchor", "medium", `Hero is the primary visual anchor — supporting elements provide context without competing`);
  })();

  return { exactHeroSubject, heroPose, heroExpression, heroScale, heroPosition, heroImportance };
}
