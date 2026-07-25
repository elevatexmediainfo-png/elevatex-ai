import { describe, expect, it } from "vitest";
import { resolveAdvertisementNarrative } from "./engine";
import {
  resolveStoryArchetype,
  resolveStoryScenario,
  resolveEnrichmentTags,
  resolveIdentitySignal,
  resolveProofElement,
  resolveObjectionCounter,
} from "./rules";
import type { CreativeStrategy } from "../creative-brain/types";
import type { VisualScenePlan }  from "../scene-planner/types";

// Phase 10.4J — Advertisement Intelligence tests.
// Verifies that rules operate on marketing DIMENSIONS (not industry names)
// and produce specific, actionable visual directives.

// ── Minimal fixtures ──────────────────────────────────────────────────────────

function sf(value: string) {
  return { value, confidence: "high" as const, source: "pattern" as const };
}

function makeStrategy(overrides: Partial<{
  heroType:       CreativeStrategy["heroDecision"]["heroType"];
  experienceType: CreativeStrategy["experienceProfile"]["primary"];
  emotionalCore:  string;
  trust:          string;
  campaignGoal:   string;
  luxuryLevel:    string;
  industryCluster:CreativeStrategy["creativeMatrix"]["industryCluster"];
  convPriority:   string;
  awareness:      string;
  desires:        string;
  fear:           string;
  audience:       string;
  urgency:        string;
  emotionalDriver:string;
  hasCert:        boolean;
  hasRating:      boolean;
  hasExpYears:    boolean;
}>): CreativeStrategy {
  const o = overrides;
  return {
    confidenceScore: 80,
    unknownFields:   [],
    heroDecision: {
      subject:        "subject",
      heroType:       o.heroType       ?? "authority",
      primarySignals: [],
      confidence:     "high",
      reasoning:      "",
    },
    experienceProfile: {
      primary:            o.experienceType  ?? "trust",
      secondary:          "none",
      intensity:          "high",
      emotionalCore:      o.emotionalCore   ?? "confidence through evidence",
      visualImplication:  "",
    },
    audience: {
      primaryAudience:   sf(o.audience    ?? "professional adults"),
      trustRequirement:  sf(o.trust       ?? "high"),
      awarenessLevel:    sf(o.awareness   ?? "problem_aware"),
      dominantFear:      sf(o.fear        ?? "none"),
      desires:           sf(o.desires     ?? "unknown"),
      painPoints:        sf(""),
    },
    marketing: {
      campaignGoal:       sf(o.campaignGoal  ?? "awareness"),
      conversionPriority: sf(o.convPriority  ?? "medium"),
      primaryCta:         sf(""),
      urgencyLevel:       sf(""),
    },
    visual: {
      luxuryLevel:        sf(o.luxuryLevel   ?? "professional_quality"),
      colorPalette:       sf(""),
      imageStyle:         sf(""),
    },
    communication: {
      tone:    sf(""),
      urgency: sf(o.urgency ?? "none"),
      cta:     sf(""),
    },
    creativeMatrix: {
      industryCluster:  o.industryCluster ?? "authority",
      emotionalDriver:  o.emotionalDriver ?? "",
      creativeTension:  "",
      narrativeEngine:  "",
    },
    business: {
      usp:           sf("premium service"),
      brandVoice:    sf(""),
      trustAssets: {
        hasCertification:  o.hasCert       ?? false,
        certifications:    [],
        hasExperienceYears:o.hasExpYears   ?? false,
        experienceYears:   undefined,
        hasRating:         o.hasRating     ?? false,
        rating:            undefined,
        hasCustomerCount:  false,
        customerCount:     undefined,
        hasCelebrity:      false,
        overallTrustStrength: "moderate",
      },
    },
    // Unused by rules — minimal stubs
    creative:  { adFormat: sf(""), creativeConcept: sf(""), layoutDirection: sf(""), visualStyle: sf(""), contentType: sf("") },
    platform:  { primary: sf(""), aspectRatio: sf(""), safeZone: sf("") },
    campaign:  { campaignPhase: sf(""), campaignType: sf(""), targetAction: sf("") },
    semanticWeights:   { trust: 0.3, luxury: 0.1, aspiration: 0.1, urgency: 0.1, social: 0.1, authority: 0.3, emotional: 0.2 },
    luxuryProfile:     { tier: "professional", signal: "", justification: "" },
  } as unknown as CreativeStrategy;
}

function makeScene(emotionalGoal = "trust_and_reassurance"): VisualScenePlan {
  return {
    sceneObjective: {
      emotionalGoal: sf(emotionalGoal),
      narrativeRole: sf(""),
      conversionFocus: sf(""),
    },
    heroSubject:        { subject: sf(""), position: sf(""), scale: sf(""), details: sf(""), importance: sf("absolute_mandatory") },
    supportingSubjects: { subjects: [], relationships: sf(""), count: "none" },
    environment:        { type: sf(""), context: sf(""), premiumDetails: sf("") },
    objects:            { required: [], optional: [], decorative: [], trust: [], educational: [] },
    composition:        { primary: sf(""), secondary: sf(""), balance: sf(""), depth: sf(""), foreground: sf(""), midground: sf(""), background: sf(""), negativeSpace: sf(""), eyeFlow: sf(""), symmetry: sf("") },
    camera:             { position: sf(""), height: sf(""), angle: sf(""), lens: sf(""), distance: sf(""), perspectiveIntent: sf("") },
    lighting:           { primary: sf(""), secondary: sf(""), mood: sf(""), shadow: sf(""), reflection: sf(""), cameraMood: sf("") },
    storytelling:       { emotionalBeat: sf(""), visualNarrative: sf(""), storyMoment: sf("") },
    renderingIntent:    { photorealism: sf("photorealistic"), commercial: sf("national_commercial"), editorial: sf("consumer_magazine"), luxury: sf("premium_polished"), realism: sf("commercial_campaign_shoot"), artifactPrevention: sf("") },
  } as unknown as VisualScenePlan;
}

// ── resolveStoryArchetype ─────────────────────────────────────────────────────

describe("resolveStoryArchetype (Phase 10.4J)", () => {
  it("authority heroType + high trust → expert_in_action", () => {
    const strategy = makeStrategy({ heroType: "authority", trust: "high" });
    expect(resolveStoryArchetype(strategy)).toBe("expert_in_action");
  });

  it("authority heroType + critical trust → expert_in_action", () => {
    const strategy = makeStrategy({ heroType: "authority", trust: "critical" });
    expect(resolveStoryArchetype(strategy)).toBe("expert_in_action");
  });

  it("transformation heroType → transformation_proof (always wins)", () => {
    // transformation heroType wins even over authority cluster
    const strategy = makeStrategy({ heroType: "transformation", industryCluster: "authority", trust: "critical" });
    expect(resolveStoryArchetype(strategy)).toBe("transformation_proof");
  });

  it("data heroType → insight_discovery", () => {
    const strategy = makeStrategy({ heroType: "data" });
    expect(resolveStoryArchetype(strategy)).toBe("insight_discovery");
  });

  it("healing experience → comfort_assurance", () => {
    const strategy = makeStrategy({ heroType: "person", experienceType: "healing", trust: "medium" });
    expect(resolveStoryArchetype(strategy)).toBe("comfort_assurance");
  });

  it("luxury experience + high luxury level → exclusive_access", () => {
    const strategy = makeStrategy({ heroType: "environment", experienceType: "luxury", luxuryLevel: "ultra_luxury", industryCluster: "social_proof" });
    expect(resolveStoryArchetype(strategy)).toBe("exclusive_access");
  });

  it("moment heroType + romance driver → intimate_occasion", () => {
    // industryCluster=social_proof + trust=medium bypasses the expert_in_action check
    const strategy = makeStrategy({
      heroType: "moment", emotionalDriver: "romance and partnership",
      industryCluster: "social_proof", trust: "medium",
    });
    expect(resolveStoryArchetype(strategy)).toBe("intimate_occasion");
  });

  it("celebration experience + corporate audience → milestone_achievement", () => {
    // Must bypass authority+trust check via social_proof cluster + medium trust
    const strategy = makeStrategy({
      heroType: "person", experienceType: "celebration",
      audience: "corporate professionals", industryCluster: "social_proof", trust: "medium",
    });
    expect(resolveStoryArchetype(strategy)).toBe("milestone_achievement");
  });

  it("celebration experience + non-corporate audience → social_celebration", () => {
    const strategy = makeStrategy({
      heroType: "person", experienceType: "celebration",
      audience: "families", industryCluster: "social_proof", trust: "medium",
    });
    expect(resolveStoryArchetype(strategy)).toBe("social_celebration");
  });
});

// ── resolveStoryScenario ──────────────────────────────────────────────────────

describe("resolveStoryScenario (Phase 10.4J)", () => {
  it("expert_in_action + critical trust → specific chairside scenario", () => {
    const strategy = makeStrategy({ trust: "critical", heroType: "authority" });
    const scene    = makeScene();
    const scenario = resolveStoryScenario("expert_in_action", strategy, scene);
    expect(scenario.length).toBeGreaterThan(40);
    expect(scenario).toContain("confidence"); // must reference trust/confidence
  });

  it("transformation_proof + fear resolved → fear referenced in scenario", () => {
    const strategy = makeStrategy({ heroType: "transformation", fear: "fear_of_pain" });
    const scene    = makeScene();
    const scenario = resolveStoryScenario("transformation_proof", strategy, scene);
    expect(scenario).toContain("fear of pain");
  });

  it("intimate_occasion + romance driver → proposal/anniversary scenario", () => {
    const strategy = makeStrategy({ heroType: "moment", emotionalDriver: "romance and love" });
    const scene    = makeScene();
    const scenario = resolveStoryScenario("intimate_occasion", strategy, scene);
    expect(scenario.toLowerCase()).toMatch(/romantic|romance|intimate|proposal|anniversary/);
  });

  it("aspiration_world + specific desires → desires reflected in scenario", () => {
    const strategy = makeStrategy({ heroType: "lifestyle", experienceType: "aspiration", desires: "financial freedom and travel" });
    const scene    = makeScene();
    const scenario = resolveStoryScenario("aspiration_world", strategy, scene);
    expect(scenario).toContain("financial freedom");
  });

  it("exclusive_access + ultra luxury → privacy/private scenario", () => {
    const strategy = makeStrategy({ heroType: "environment", experienceType: "luxury", luxuryLevel: "ultra_luxury" });
    const scene    = makeScene();
    const scenario = resolveStoryScenario("exclusive_access", strategy, scene);
    expect(scenario.toLowerCase()).toMatch(/private|few|catalogue|exclusive/);
  });

  it("returns non-empty string for all 12 archetypes", () => {
    const archetypes = [
      "expert_in_action", "transformation_proof", "intimate_occasion", "social_celebration",
      "aspiration_world", "exclusive_access", "insight_discovery", "comfort_assurance",
      "trust_reveal", "milestone_achievement", "ownership_pride", "process_transparency",
    ] as const;
    const strategy = makeStrategy({});
    const scene    = makeScene();
    for (const arch of archetypes) {
      const result = resolveStoryScenario(arch, strategy, scene);
      expect(result.length, `archetype ${arch} returned empty string`).toBeGreaterThan(20);
    }
  });
});

// ── resolveEnrichmentTags ─────────────────────────────────────────────────────

describe("resolveEnrichmentTags (Phase 10.4J)", () => {
  it("authority heroType → expert_demonstrating tag always present", () => {
    const strategy = makeStrategy({ heroType: "authority" });
    const scene    = makeScene();
    const tags     = resolveEnrichmentTags("expert_in_action", strategy, scene);
    expect(tags).toContain("expert_demonstrating");
  });

  it("authority + critical trust → process_visible + evidence_based tags", () => {
    const strategy = makeStrategy({ heroType: "authority", trust: "critical" });
    const scene    = makeScene();
    const tags     = resolveEnrichmentTags("expert_in_action", strategy, scene);
    expect(tags).toContain("process_visible");
    expect(tags).toContain("evidence_based");
  });

  it("romance driver → romantic_occasion + intimate_moment tags", () => {
    const strategy = makeStrategy({ heroType: "moment", emotionalDriver: "romance and love" });
    const scene    = makeScene();
    const tags     = resolveEnrichmentTags("intimate_occasion", strategy, scene);
    expect(tags).toContain("romantic_occasion");
    expect(tags).toContain("intimate_moment");
  });

  it("proposal driver → proposal_moment tag", () => {
    const strategy = makeStrategy({ heroType: "moment", emotionalDriver: "proposal and engagement" });
    const scene    = makeScene();
    const tags     = resolveEnrichmentTags("intimate_occasion", strategy, scene);
    expect(tags).toContain("proposal_moment");
  });

  it("ultra_luxury → ultra_premium tag", () => {
    const strategy = makeStrategy({ heroType: "environment", luxuryLevel: "ultra_luxury" });
    const scene    = makeScene();
    const tags     = resolveEnrichmentTags("exclusive_access", strategy, scene);
    expect(tags).toContain("ultra_premium");
  });

  it("never returns more than 12 tags", () => {
    const strategy = makeStrategy({
      heroType: "authority", trust: "critical", luxuryLevel: "ultra_luxury",
      emotionalDriver: "romance proposal anniversary", audience: "corporate affluent",
      hasCert: true, hasRating: true, hasExpYears: true, convPriority: "immediate",
      awareness: "most_aware",
    });
    const scene = makeScene();
    const tags  = resolveEnrichmentTags("expert_in_action", strategy, scene);
    expect(tags.length).toBeLessThanOrEqual(12);
  });

  it("always includes the archetype as the first tag", () => {
    const strategy = makeStrategy({ heroType: "product" });
    const scene    = makeScene();
    const tags     = resolveEnrichmentTags("ownership_pride", strategy, scene);
    expect(tags[0]).toBe("ownership_pride");
  });

  it("process_transparency archetype → craft_visible + maker_hands tags", () => {
    const strategy = makeStrategy({ heroType: "product" });
    const scene    = makeScene();
    const tags     = resolveEnrichmentTags("process_transparency", strategy, scene);
    expect(tags).toContain("craft_visible");
    expect(tags).toContain("maker_hands");
  });
});

// ── resolveProofElement ───────────────────────────────────────────────────────

describe("resolveProofElement (Phase 10.4J)", () => {
  it("low trust → returns undefined", () => {
    const strategy = makeStrategy({ trust: "low" });
    expect(resolveProofElement(strategy)).toBeUndefined();
  });

  it("critical trust without trust assets → environmental proof string", () => {
    const result = resolveProofElement(makeStrategy({ trust: "critical" }));
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(10);
  });

  it("high trust with certification → includes certification marks detail", () => {
    // hasCert=true adds certifications to proofParts only if certifications[] is non-empty
    const strategy = makeStrategy({ trust: "high", hasCert: true });
    // Override certifications in the trust assets to be non-empty
    (strategy.business.trustAssets as unknown as Record<string, unknown>).certifications = ["ISO 9001"];
    const result = resolveProofElement(strategy);
    expect(result).toContain("certification marks");
  });
});

// ── resolveObjectionCounter ───────────────────────────────────────────────────

describe("resolveObjectionCounter (Phase 10.4J)", () => {
  it("no fear → returns undefined", () => {
    expect(resolveObjectionCounter(makeStrategy({ fear: "none" }))).toBeUndefined();
  });

  it("fear_of_pain → comfort-focused counter", () => {
    const result = resolveObjectionCounter(makeStrategy({ fear: "fear_of_pain" }));
    expect(result).toBeDefined();
    expect(result!.toLowerCase()).toMatch(/comfort|ease|pain|posture/);
  });

  it("price_concern → quality/value counter", () => {
    const result = resolveObjectionCounter(makeStrategy({ fear: "price_concern" }));
    expect(result).toBeDefined();
    expect(result!.toLowerCase()).toMatch(/quality|value|price|environment/);
  });
});

// ── resolveAdvertisementNarrative (integration) ───────────────────────────────

describe("resolveAdvertisementNarrative — integration (Phase 10.4J)", () => {
  it("dental authority + critical trust → full non-generic narrative", () => {
    const strategy = makeStrategy({
      heroType: "authority", trust: "critical", industryCluster: "authority",
      experienceType: "trust", emotionalCore: "safety through visible expertise",
      fear: "fear_of_surgery",
    });
    const scene = makeScene("trust_and_reassurance");
    const narrative = resolveAdvertisementNarrative(strategy, scene);

    expect(narrative.storyArchetype).toBe("expert_in_action");
    expect(narrative.storyScenario.length).toBeGreaterThan(40);
    expect(narrative.emotionalMoment.length).toBeGreaterThan(20);
    expect(narrative.identitySignal.length).toBeGreaterThan(10);
    expect(narrative.conversionMoment.length).toBeGreaterThan(20);
    expect(narrative.enrichmentTags).toContain("expert_demonstrating");
    expect(narrative.enrichmentTags).toContain("evidence_based");
    // objection counter present because fear_of_surgery is set
    expect(narrative.objectionCounter).toBeDefined();
  });

  it("jewellery proposal + ultra luxury → exclusive_access with romantic enrichment tags", () => {
    // ultra_luxury + experienceType=luxury → exclusive_access wins in priority tree.
    // But emotionalDriver=romance/proposal still adds romantic enrichment tags.
    const strategy = makeStrategy({
      heroType: "moment", trust: "medium",
      luxuryLevel: "ultra_luxury", experienceType: "luxury",
      emotionalDriver: "romance proposal engagement", industryCluster: "social_proof",
    });
    const scene = makeScene("aspiration_and_desire");
    const narrative = resolveAdvertisementNarrative(strategy, scene);

    expect(narrative.storyArchetype).toBe("exclusive_access");
    expect(narrative.enrichmentTags).toContain("romantic_occasion");
    expect(narrative.enrichmentTags).toContain("proposal_moment");
    expect(narrative.enrichmentTags).toContain("ultra_premium");
  });

  it("restaurant celebration + family audience → social_celebration narrative", () => {
    const strategy = makeStrategy({
      heroType: "person", experienceType: "celebration",
      audience: "families and couples", trust: "medium",
      emotionalDriver: "family birthday celebration",
    });
    const scene = makeScene("joy_and_delight");
    const narrative = resolveAdvertisementNarrative(strategy, scene);

    expect(narrative.storyArchetype).toBe("social_celebration");
    expect(narrative.storyScenario.length).toBeGreaterThan(30);
    expect(narrative.enrichmentTags).toContain("family_context");
    expect(narrative.enrichmentTags).toContain("birthday_occasion");
  });

  it("always returns all required non-optional fields", () => {
    const narrative = resolveAdvertisementNarrative(makeStrategy({}), makeScene());
    expect(typeof narrative.storyScenario).toBe("string");
    expect(typeof narrative.emotionalMoment).toBe("string");
    expect(typeof narrative.identitySignal).toBe("string");
    expect(typeof narrative.conversionMoment).toBe("string");
    expect(typeof narrative.storyArchetype).toBe("string");
    expect(Array.isArray(narrative.enrichmentTags)).toBe(true);
    expect(narrative.storyScenario.length).toBeGreaterThan(0);
    expect(narrative.emotionalMoment.length).toBeGreaterThan(0);
  });

  it("immediate conversion priority → specific urgency-forward conversion moment", () => {
    const strategy = makeStrategy({ convPriority: "immediate" });
    const narrative = resolveAdvertisementNarrative(strategy, makeScene());
    expect(narrative.conversionMoment.toLowerCase()).toMatch(/call|today|tomorrow|wait|friction/);
  });

  it("lead_generation goal → lead-generation conversion suffix", () => {
    const strategy = makeStrategy({ campaignGoal: "lead_generation" });
    const narrative = resolveAdvertisementNarrative(strategy, makeScene());
    // lead_generation adds ". The friction has been removed..." suffix
    expect(narrative.conversionMoment.toLowerCase()).toContain("friction");
  });
});
