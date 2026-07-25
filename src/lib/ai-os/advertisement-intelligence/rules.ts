// Phase 10.4J — Advertisement Intelligence: Rule Engine.
//
// Pure rule functions. No I/O, no hardcoded industries, no LLM calls.
// Rules operate on marketing DIMENSIONS (experience type, trust requirement,
// campaign goal, emotional driver, luxury level) — NOT on industry names.
//
// Same inputs → same outputs. Fully deterministic and testable.

import type { CreativeStrategy, ExperienceType, HeroType, IndustryCluster } from "../creative-brain/types";
import type { VisualScenePlan } from "../scene-planner/types";
import type { StoryArchetype, AdvertisementNarrative } from "./types";

// ── Rule 1: Story Archetype Resolution ───────────────────────────────────────
// Priority tree: most specific signal wins.

export function resolveStoryArchetype(strategy: CreativeStrategy): StoryArchetype {
  const heroType  = strategy.heroDecision.heroType;
  const exp       = strategy.experienceProfile.primary;
  const trust     = strategy.audience.trustRequirement.value;
  const goal      = strategy.marketing.campaignGoal.value;
  const luxury    = strategy.visual.luxuryLevel.value;
  const cluster   = strategy.creativeMatrix.industryCluster;
  const convPrio  = strategy.marketing.conversionPriority.value;
  const awareness = strategy.audience.awarenessLevel.value;

  // Transformation always wins when explicitly selected
  if (heroType === "transformation" || exp === "transformation") return "transformation_proof";

  // Data visualization
  if (heroType === "data") return "insight_discovery";

  // Authority with high/critical trust requirement
  if ((heroType === "authority" || cluster === "authority") && (trust === "high" || trust === "critical")) {
    return "expert_in_action";
  }

  // Process transparency for product hero with authenticity/trust campaign
  if (heroType === "product" && (exp === "discovery" || goal === "trust")) return "process_transparency";

  // Healing and comfort-first industries
  if (exp === "healing") return "comfort_assurance";

  // Trust-building as explicit goal with ambient credibility
  if (goal === "trust" && cluster !== "authority") return "trust_reveal";

  // Luxury + exclusivity (not authority-cluster industries)
  if ((luxury === "ultra_luxury" || luxury === "high") && exp === "luxury") return "exclusive_access";

  // Education goal or discovery experience
  if (exp === "education" || goal === "education") return "insight_discovery";

  // Celebration or belonging experience
  if (exp === "celebration" || exp === "belonging") {
    const audience = strategy.audience.primaryAudience.value.toLowerCase();
    if (audience.includes("corporate") || audience.includes("business") || audience.includes("professional")) {
      return "milestone_achievement";
    }
    return "social_celebration";
  }

  // Moment-type hero (specific emotional peak)
  if (heroType === "moment") {
    const driver = strategy.creativeMatrix.emotionalDriver.toLowerCase();
    if (driver.includes("romance") || driver.includes("love") || driver.includes("partner") ||
        driver.includes("propos") || driver.includes("intimate") || driver.includes("wedding")) {
      return "intimate_occasion";
    }
    return "milestone_achievement";
  }

  // Product hero with immediate conversion priority
  if (heroType === "product" && convPrio === "immediate") return "ownership_pride";

  // Environment hero (architectural/spatial)
  if (heroType === "environment") {
    if (luxury === "high" || luxury === "ultra_luxury") return "exclusive_access";
    return "aspiration_world";
  }

  // Lifestyle hero
  if (heroType === "lifestyle" || exp === "aspiration") return "aspiration_world";

  // Problem-aware audience — pre-handle the objection
  if (awareness === "problem_aware") return "comfort_assurance";

  // Product-aware audience — proof and comparison needed
  if (awareness === "product_aware" || awareness === "solution_aware") return "trust_reveal";

  return "aspiration_world";
}

// ── Rule 2: Story Scenario Construction ──────────────────────────────────────
// Templates are built from marketing dimensions — not industry lookup tables.

export function resolveStoryScenario(archetype: StoryArchetype, strategy: CreativeStrategy, scene: VisualScenePlan): string {
  const emotionalCore = strategy.experienceProfile.emotionalCore
    || strategy.creativeMatrix.emotionalDriver || "the right choice made visible";
  const trust    = strategy.audience.trustRequirement.value;
  const luxury   = strategy.visual.luxuryLevel.value;
  const desires  = strategy.audience.desires.value;
  const fear     = strategy.audience.dominantFear.value;
  const driver   = strategy.creativeMatrix.emotionalDriver?.toLowerCase() ?? "";
  const audience = strategy.audience.primaryAudience.value;
  const usp      = strategy.business.usp.value;
  const goal     = strategy.marketing.campaignGoal.value;

  switch (archetype) {
    case "expert_in_action": {
      if (trust === "critical") {
        return `Specialist actively guiding a client or patient through the evidence — the exact moment understanding arrives and decision confidence replaces doubt. ${emotionalCore}`;
      }
      if (trust === "high") {
        return `Authority figure in focused mastery — demonstrating the process that produces the result, the environment itself confirming expertise before a single word is spoken. ${emotionalCore}`;
      }
      return `Expert in natural action — knowledge and care visible without effort, the viewer seeing exactly who they would trust with this. ${emotionalCore}`;
    }

    case "transformation_proof": {
      if (fear && fear !== "none") {
        const fearLabel = fear.replace(/_/g, " ");
        return `The result moment: ${fearLabel} demonstrably resolved. Real, earned change captured at the precise instant of recognition — not staged, not aspirational. The viewer sees the possibility for themselves`;
      }
      if (luxury === "high" || luxury === "ultra_luxury") {
        return `The transformation visible in how the subject carries themselves — posture, expression, presence. Not the dramatic before/after, but the quieter, more powerful after. ${emotionalCore}`;
      }
      return `The specific before-and-after where the claim is proved without a word — genuine reaction to a meaningful change the viewer recognises could be their own. ${emotionalCore}`;
    }

    case "intimate_occasion": {
      if (driver.includes("romance") || driver.includes("love") || driver.includes("propos") || driver.includes("wedding")) {
        return `A specific romantic milestone — the moment where an emotional investment materialises into a memory: the proposal, the anniversary, the private celebration that only the two of them will remember. The brand is part of the story, not a prop`;
      }
      if (driver.includes("family") || driver.includes("parent") || driver.includes("child")) {
        return `A meaningful family occasion — the milestone that makes the investment worthwhile. Not a generic family scene but a specific moment: the birthday, the graduation dinner, the homecoming. ${emotionalCore}`;
      }
      return `A specific meaningful occasion — the moment where the category becomes emotionally relevant. The viewer recognises the occasion type and maps themselves onto the scene. ${emotionalCore}`;
    }

    case "social_celebration": {
      if (audience && audience !== "unknown") {
        const audienceLower = audience.toLowerCase();
        if (audienceLower.includes("family")) {
          return `A genuine family gathering where the brand enables the occasion — warmth, generations, and the specific energy of people who are actually glad to be together. Not a stock photo moment`;
        }
        if (audienceLower.includes("friend")) {
          return `A real group of friends at a specific moment — the kind of occasion that needs no explanation. The brand is part of the environment, not the reason for being there`;
        }
      }
      return `A genuine group moment — warmth and connection where the product or service enables the occasion without dominating it. The viewer sees their own people in the scene. ${emotionalCore}`;
    }

    case "aspiration_world": {
      if (desires && desires !== "unknown") {
        return `A window into the life that becomes possible: ${desires.slice(0, 120)}. The viewer recognises themselves in the scene — not who they are today, but who they intend to become`;
      }
      return `A moment inside the aspirational world — the life that opens when the viewer makes this choice. Specific, desirable, and believable enough to feel within reach. ${emotionalCore}`;
    }

    case "exclusive_access": {
      if (luxury === "ultra_luxury") {
        return `A glimpse into the private experience few have — nothing that could appear in a catalogue, everything chosen and considered. The viewer understands that entry requires a decision. ${emotionalCore}`;
      }
      return `A moment of privileged access — the environment, the service, the experience that distinguishes those who chose quality. ${emotionalCore}`;
    }

    case "insight_discovery": {
      if (goal === "education") {
        return `The moment understanding arrives — the viewer learns something they didn't know they needed to see. The scene communicates the gap between not knowing and knowing, and positions the brand as the bridge`;
      }
      return `The reveal: information or a result becoming clear in real time. The subject's expression communicates the shift — the viewer experiences the insight vicariously and wants it for themselves. ${emotionalCore}`;
    }

    case "comfort_assurance": {
      if (fear && fear !== "none") {
        const fearLabel = fear.replace(/_/g, " ");
        return `${capitalise(fearLabel)} visually addressed before it can be spoken — the scene communicates care, safety, and ease through the subject's posture, expression, and the environment itself. The concern never needed to become a question`;
      }
      return `The gentleness of the process made visible — care and precision together, without a trace of intimidation or uncertainty. The viewer exhales. ${emotionalCore}`;
    }

    case "trust_reveal": {
      const ta = strategy.business.trustAssets;
      const proofHints: string[] = [];
      if (ta.hasExperienceYears && ta.experienceYears) proofHints.push(`${ta.experienceYears} years in practice`);
      if (ta.hasCertification && ta.certifications.length) proofHints.push("certification marks");
      if (ta.hasCustomerCount && ta.customerCount) proofHints.push(`${ta.customerCount} served`);
      if (ta.hasRating && ta.rating) proofHints.push(`${ta.rating} rating`);

      const proofList = proofHints.length > 0 ? proofHints.slice(0, 2).join(" and ") : "the environment itself";
      return `Credibility visible as background texture — ${proofList} present in the scene as natural detail, not as a display. The viewer trusts before they read a single word`;
    }

    case "milestone_achievement": {
      if (driver.includes("pride") || driver.includes("achievement") || driver.includes("success")) {
        return `The peak moment of a genuine achievement — real emotion at the exact point where the work pays off. Not a simulation of success but the thing itself: the moment the effort becomes undeniable`;
      }
      return `The occasion that marks a clear before and after — the milestone the viewer has been working toward. ${emotionalCore}`;
    }

    case "ownership_pride": {
      if (usp && usp !== "unknown") {
        return `The subject in natural possession of the product — identity confirmed through the object. The ${usp.slice(0, 80)} made visible without explanation: the viewer understands what kind of person owns this`;
      }
      return `The subject with the product in their world — not a demonstration, an identity statement. The viewer sees themselves in the scene and recognises the version of themselves they prefer`;
    }

    case "process_transparency": {
      return `The craft behind the result made visible — the hand, the material, the precision, the time. Not the marketing story but the actual process: the viewer trusts what they can see being made. ${emotionalCore}`;
    }
  }
}

// ── Rule 3: Emotional Moment Resolution ──────────────────────────────────────

export function resolveEmotionalMoment(archetype: StoryArchetype, strategy: CreativeStrategy, scene: VisualScenePlan): string {
  const emotionalGoal = scene.sceneObjective.emotionalGoal.value;
  const visualImpl    = strategy.experienceProfile.visualImplication || "";
  const driver        = strategy.creativeMatrix.emotionalDriver || "";

  const MOMENT_TEMPLATES: Record<StoryArchetype, string> = {
    expert_in_action:    `The subject's shift from apprehension to confidence — visible the instant understanding replaces uncertainty`,
    transformation_proof:`The unguarded reaction to a result that exceeded expectations — surprise, relief, and quiet pride together`,
    intimate_occasion:   `The private quality of a shared moment — two people (or a person alone) in the emotional centre of a memory being made`,
    social_celebration:  `The warmth of genuine togetherness — laughter or a glance between people who are actually glad to be in this moment`,
    aspiration_world:    `The ease of belonging — the subject in their element, making this world look like the natural place to be`,
    exclusive_access:    `The composure of someone for whom this is simply their standard — luxury worn, not displayed`,
    insight_discovery:   `The instant of comprehension — the expression when something clicks, the posture when doubt becomes clarity`,
    comfort_assurance:   `The visible relaxation of a concern being resolved — shoulders dropping, expression opening, the body communicating that everything is fine`,
    trust_reveal:        `The quiet confidence of someone in the right hands — at ease, not performing ease`,
    milestone_achievement:`The genuine peak of earned accomplishment — not performed pride but the real thing: exhaustion and satisfaction together`,
    ownership_pride:     `The subtle contentment of having chosen well — the subject with their object, both exactly where they should be`,
    process_transparency:`The focus and steadiness of genuine expertise — the maker's hands and the material as a portrait of mastery`,
  };

  const base = MOMENT_TEMPLATES[archetype];

  // Enrich with emotional goal from scene planner if specific
  if (emotionalGoal && emotionalGoal !== "unknown") {
    const enriched = goalToEmotionalDetail(emotionalGoal);
    if (enriched) return `${base}. Specific emotional register: ${enriched}`;
  }

  if (visualImpl && visualImpl !== "unknown") {
    return `${base}. Visual implication: ${visualImpl.slice(0, 100)}`;
  }

  return base;
}

function goalToEmotionalDetail(goal: string): string | null {
  const map: Record<string, string> = {
    trust_and_reassurance:     "the specific calm of knowing you've made the right choice",
    aspiration_and_desire:     "a quiet longing — the viewer wants this and believes they can have it",
    excitement_and_urgency:    "charged energy — movement, forward momentum, no time to wait",
    transformation_and_hope:   "the fragile brightness of genuine hope — before the results are certain but after the commitment is made",
    authority_and_expertise:   "the steady confidence of someone who has done this ten thousand times",
    joy_and_delight:           "unguarded delight — the kind that isn't performed for a camera",
    curiosity_and_intrigue:    "the open posture of genuine interest — leaning in, eyes alive",
  };
  return map[goal] ?? null;
}

// ── Rule 4: Proof Element Resolution ─────────────────────────────────────────

export function resolveProofElement(strategy: CreativeStrategy): string | undefined {
  const trust = strategy.audience.trustRequirement.value;
  if (trust === "low") return undefined;

  const ta = strategy.business.trustAssets;
  const proofParts: string[] = [];

  if (ta.hasExperienceYears && ta.experienceYears) {
    proofParts.push(`${ta.experienceYears} of practice visible in the environment's character`);
  }
  if (ta.hasCertification && ta.certifications.length > 0) {
    proofParts.push(`certification marks present as ambient detail`);
  }
  if (ta.hasRating && ta.rating) {
    proofParts.push(`social proof implied by the professional quality of the setting`);
  }
  if (ta.hasCustomerCount && ta.customerCount) {
    proofParts.push(`scale of practice readable in the environment — this is not a first attempt`);
  }

  if (proofParts.length === 0) {
    // Even without explicit trust assets, suggest environmental proof
    if (trust === "critical") return "The environment itself as credential: spotless, ordered, purposeful — a space that has seen this done many times before";
    if (trust === "high") return "Professional quality visible in the setting — the kind of detail that only accumulates through experience";
    return undefined;
  }

  return proofParts.slice(0, 2).join("; ") + " — nothing announced, everything present";
}

// ── Rule 5: Objection Counter Resolution ──────────────────────────────────────

export function resolveObjectionCounter(strategy: CreativeStrategy): string | undefined {
  const fear = strategy.audience.dominantFear.value;
  if (!fear || fear === "none") return undefined;

  const OBJECTION_COUNTER: Record<string, string> = {
    fear_of_pain:     "Comfort visible in the subject's expression and posture — the body communicating ease before any claim is made about it",
    fear_of_surgery:  "The clinical environment shown as calm, ordered, and unhurried — precision without drama",
    price_concern:    "The quality of the environment and the process makes the price implicit — the viewer understands value before they see a number",
    trust_issue:      "Expert in their natural habitat of mastery — the credential is ambient, not displayed as a prop",
    time_concern:     "Efficiency visible in the scene's composition — purposeful, ordered, no wasted motion",
    complexity_concern:"The process reduced to its clearest, most legible moment — the viewer understands without effort",
    quality_concern:  "Craftsmanship and precision visible in the detail — the image communicates that corners have not been cut",
    result_doubt:     "The outcome visible or clearly implied — the viewer sees the proof before they read the claim",
    side_effect_fear: "The subject at ease, in full colour, in the middle of normal life — the viewer sees the after without the drama",
    embarrassment:    "A scene of natural dignity — the subject comfortable, un-self-conscious, in their element",
    other:            "The scene addresses the category's common hesitation without naming it — comfort communicated through visual evidence",
  };

  return OBJECTION_COUNTER[fear] ?? undefined;
}

// ── Rule 6: Identity Signal Resolution ───────────────────────────────────────

export function resolveIdentitySignal(strategy: CreativeStrategy): string {
  const desires = strategy.audience.desires.value;
  const exp     = strategy.experienceProfile.primary;
  const luxury  = strategy.visual.luxuryLevel.value;
  const trust   = strategy.audience.trustRequirement.value;

  // Specific desire-driven identity
  if (desires && desires !== "unknown") {
    const trimmed = desires.slice(0, 100).toLowerCase();
    return `A person who believes ${trimmed} — and has decided to do something about it`;
  }

  const IDENTITY_BY_EXPERIENCE: Record<ExperienceType, string> = {
    transformation: "A person who invests in meaningful, lasting change — not the cheapest option, the right one",
    aspiration:     "Someone who sees their current situation as the starting point, not the destination",
    trust:          "A person who chooses carefully, expects expertise, and knows the difference when they see it",
    luxury:         "Someone who understands that the best version of something is worth the difference",
    belonging:      "A person who measures the quality of a choice by the quality of the people they can share it with",
    education:      "Someone who believes that knowing more leads to choosing better — and acts on it",
    convenience:    "A person who has earned the right to expect things to work without effort",
    celebration:    "Someone who believes certain moments deserve to be done properly — and sees this as one of them",
    discovery:      "A person genuinely open to being surprised by what's possible",
    healing:        "Someone who has decided that comfort, care, and recovery are worth prioritising",
  };

  const identityFromExp = IDENTITY_BY_EXPERIENCE[exp];
  if (identityFromExp) return identityFromExp;

  // Fallback by trust level
  if (trust === "critical" || trust === "high") {
    return "A person who does not compromise on expertise when it matters — and this matters";
  }
  if (luxury === "high" || luxury === "ultra_luxury") {
    return "Someone who has developed a preference for the best version of the things they care about";
  }

  return "A person who has decided this is worth doing right";
}

// ── Rule 7: Urgency Visual Resolution ────────────────────────────────────────

export function resolveUrgencyVisual(strategy: CreativeStrategy): string | undefined {
  const urgency = strategy.communication.urgency.value;
  if (urgency === "none" || urgency === "low") return undefined;

  const convPrio = strategy.marketing.conversionPriority.value;

  const URGENCY_VISUAL: Record<string, string> = {
    immediate: "The scene implies demand — a full appointment book visible in background, a waiting area, a queue of the kind that signals quality rather than inconvenience",
    high:      "The occasion or season visible as natural context — the right moment is now, and the scene communicates that without stating it",
    medium:    "The window of opportunity present in the scene's specific detail — a seasonal element, an occasion, a limited context that implies the viewer shouldn't wait indefinitely",
  };

  return URGENCY_VISUAL[urgency] ?? undefined;
}

// ── Rule 8: Conversion Moment Resolution ─────────────────────────────────────

export function resolveConversionMoment(archetype: StoryArchetype, strategy: CreativeStrategy): string {
  const convPrio  = strategy.marketing.conversionPriority.value;
  const goal      = strategy.marketing.campaignGoal.value;

  if (convPrio === "immediate") {
    return "The viewer feels: I've seen enough. I want this, I know exactly who to call, and there's no reason to wait until tomorrow";
  }

  const CONVERSION_BY_ARCHETYPE: Record<StoryArchetype, string> = {
    expert_in_action:    "The viewer thinks: this is who I want doing this for me — the only remaining question is when",
    transformation_proof:"The viewer feels: that could be me — and now I actually believe it can be, not just hope it might be",
    intimate_occasion:   "The viewer imagines: when my moment comes, this is where it belongs — and they start planning",
    social_celebration:  "The viewer thinks: this is the kind of experience I want to give the people I care about",
    aspiration_world:    "The viewer feels: I want to be in that world — and this is the door I'd walk through to get there",
    exclusive_access:    "The viewer thinks: I've earned this, and now I know where to find it — and it's within reach",
    insight_discovery:   "The viewer realises: I didn't know this was possible — I need to find out more, right now",
    comfort_assurance:   "The viewer thinks: my concern doesn't have to stop me from doing this — and they reach for the phone",
    trust_reveal:        "The viewer feels: this is a place I can trust before I've spoken to a single person there",
    milestone_achievement:"The viewer imagines: this is what it looks like when I reach my version of this — and they want it",
    ownership_pride:     "The viewer thinks: I see myself with this — and they want to feel that way today, not eventually",
    process_transparency:"The viewer trusts: I can see how this is made. That's why it's worth the difference",
  };

  if (goal === "lead_generation") {
    return CONVERSION_BY_ARCHETYPE[archetype] + ". The friction has been removed — the next step is obvious";
  }

  return CONVERSION_BY_ARCHETYPE[archetype];
}

// ── Rule 9: Enrichment Tags ───────────────────────────────────────────────────
// Tags refine the generic archetype into specific story moments.
// These are the specific contexts that prevent "beautiful dentist" becoming the output.

export function resolveEnrichmentTags(archetype: StoryArchetype, strategy: CreativeStrategy, scene: VisualScenePlan): string[] {
  const tags: Set<string> = new Set([archetype]);

  const exp     = strategy.experienceProfile.primary;
  const heroType = strategy.heroDecision.heroType;
  const driver  = strategy.creativeMatrix.emotionalDriver?.toLowerCase() ?? "";
  const audience = strategy.audience.primaryAudience.value.toLowerCase();
  const goal    = strategy.marketing.campaignGoal.value;
  const fear    = strategy.audience.dominantFear.value;
  const luxury  = strategy.visual.luxuryLevel.value;
  const trust   = strategy.audience.trustRequirement.value;
  const awareness = strategy.audience.awarenessLevel.value;
  const ta      = strategy.business.trustAssets;
  const convPrio = strategy.marketing.conversionPriority.value;
  const emotional = scene.sceneObjective.emotionalGoal.value;

  // Occasion-based enrichments
  if (driver.includes("romance") || driver.includes("love") || driver.includes("partner")) {
    tags.add("romantic_occasion"); tags.add("intimate_moment");
  }
  if (driver.includes("propos")) { tags.add("proposal_moment"); tags.add("marriage"); }
  if (driver.includes("wedding") || driver.includes("anniversary")) { tags.add("wedding_context"); tags.add("anniversary"); }
  if (driver.includes("birthday") || driver.includes("celebrat")) { tags.add("birthday_occasion"); }
  if (driver.includes("family") || driver.includes("parent") || driver.includes("child")) {
    tags.add("family_context"); tags.add("multi_generational");
  }
  if (driver.includes("legacy") || driver.includes("inherit") || driver.includes("heirloom")) {
    tags.add("inheritance_moment"); tags.add("legacy_gifting");
  }

  // Audience-based enrichments
  if (audience.includes("corporate") || audience.includes("business")) {
    tags.add("corporate_context"); tags.add("professional_occasion");
  }
  if (audience.includes("famil")) { tags.add("family_gathering"); }
  if (audience.includes("friend")) { tags.add("social_gathering"); }
  if (audience.includes("young") || audience.includes("millenial") || audience.includes("gen z")) {
    tags.add("young_professional"); tags.add("modern_context");
  }
  if (audience.includes("premium") || audience.includes("affluent") || audience.includes("high net")) {
    tags.add("affluent_audience"); tags.add("discerning_buyer");
  }

  // Authority-specific enrichments
  if (heroType === "authority") {
    tags.add("expert_demonstrating");
    if (trust === "critical") { tags.add("process_visible"); tags.add("evidence_based"); }
    if (ta.hasCertification) tags.add("certified_authority");
    if (ta.hasExperienceYears) tags.add("experienced_specialist");
    if (ta.hasRating) tags.add("rated_and_reviewed");
  }

  // Transformation-specific enrichments
  if (heroType === "transformation" || exp === "transformation") {
    tags.add("before_after_moment");
    if (fear && fear !== "none") tags.add(`${fear}_resolved`);
    if (luxury === "high" || luxury === "ultra_luxury") tags.add("elegant_transformation");
  }

  // Trust enrichments
  if (ta.overallTrustStrength === "proven") tags.add("proven_track_record");
  if (ta.hasCustomerCount) tags.add("scale_of_service");
  if (ta.hasCelebrity) tags.add("celebrity_social_proof");

  // Luxury enrichments
  if (luxury === "ultra_luxury") { tags.add("ultra_premium"); tags.add("private_world"); tags.add("by_invitation"); }
  else if (luxury === "high") { tags.add("premium_context"); tags.add("elevated_experience"); }

  // Conversion-readiness enrichments
  if (convPrio === "immediate") tags.add("immediate_action_trigger");
  if (awareness === "most_aware") tags.add("offer_ready_audience");
  if (awareness === "problem_aware") tags.add("pain_aware_audience");

  // Process and craft enrichments
  if (archetype === "process_transparency") { tags.add("craft_visible"); tags.add("maker_hands"); tags.add("material_quality"); }

  // Emotional register enrichments
  if (emotional && emotional !== "unknown") tags.add(emotional);

  return [...tags].slice(0, 12); // cap at 12 tags for translator brevity
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
