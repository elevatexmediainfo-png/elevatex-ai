import { describe, expect, it } from "vitest";
import { buildMemoryEntry } from "./entry-builder";
import type { MemoryEntryParams } from "./entry-builder";
import type { SceneIndustry } from "../../prompt-spec/scene-builder";

// ── Minimal params fixture ────────────────────────────────────────────────────

function minimalParams(overrides?: Partial<MemoryEntryParams>): MemoryEntryParams {
  return {
    userId:           "user-test",
    rawIdea:          "Restaurant promo for Mother's Day",
    industry:         "restaurant" as SceneIndustry,
    campaignGoal:     "awareness",
    luxuryTier:       "mid",
    selectedRouteId:  "route-chef-authority",
    heroMomentId:     "",
    sceneTypeId:      "",
    archetypeId:      "",
    routeScore: {
      relevance: 0.8, diversity: 0.9, industryFit: 0.75,
      tierMatch: 0.7, seasonalBoost: 0.6, total: 0.77,
    },
    heroSubjectText:  "A chef plating a seasonal dish",
    environmentText:  "professional_studio",
    lightingText:     "soft_natural",
    compositionText:  "rule_of_thirds",
    finalPrompt:      "A chef in a modern kitchen...",
    providerTarget:   "fal_flux",
    ...overrides,
  };
}

// ── Structure ─────────────────────────────────────────────────────────────────

describe("buildMemoryEntry — structure", () => {
  it("returns a CreativeMemoryEntry with a UUID id", () => {
    const entry = buildMemoryEntry(minimalParams());
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("two calls produce different ids", () => {
    const a = buildMemoryEntry(minimalParams());
    const b = buildMemoryEntry(minimalParams());
    expect(a.id).not.toBe(b.id);
  });

  it("sets timestamp to approximately now", () => {
    const before = Date.now();
    const entry  = buildMemoryEntry(minimalParams());
    const after  = Date.now();
    expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp.getTime()).toBeLessThanOrEqual(after);
  });
});

// ── Input block ───────────────────────────────────────────────────────────────

describe("buildMemoryEntry — input block", () => {
  it("stores rawIdea, industry, campaignGoal, luxuryTier", () => {
    const p = minimalParams();
    const entry = buildMemoryEntry(p);
    expect(entry.input.rawIdea).toBe(p.rawIdea);
    expect(entry.input.industry).toBe(p.industry);
    expect(entry.input.campaignGoal).toBe(p.campaignGoal);
    expect(entry.input.luxuryTier).toBe(p.luxuryTier);
  });

  it("builds signals with industry, campaignGoal, rawIdea, luxuryTier", () => {
    const p = minimalParams();
    const entry = buildMemoryEntry(p);
    expect(entry.input.signals.industry).toBe(p.industry);
    expect(entry.input.signals.campaignGoal).toBe(p.campaignGoal);
    expect(entry.input.signals.rawIdea).toBe(p.rawIdea);
    expect(entry.input.signals.luxuryTier).toBe(p.luxuryTier);
  });
});

// ── Blueprint block ───────────────────────────────────────────────────────────

describe("buildMemoryEntry — blueprint block", () => {
  it("stores selectedRouteId", () => {
    const entry = buildMemoryEntry(minimalParams({ selectedRouteId: "route-abc" }));
    expect(entry.blueprint.selectedRouteId).toBe("route-abc");
  });

  it("stores heroMomentId and sceneTypeId when provided as empty (backward compat)", () => {
    const entry = buildMemoryEntry(minimalParams());
    expect(entry.blueprint.heroMomentId).toBe("");
    expect(entry.blueprint.sceneTypeId).toBe("");
  });

  it("Phase 10.4I — stores real heroMomentId and sceneTypeId from knowledge graph", () => {
    const entry = buildMemoryEntry(minimalParams({
      heroMomentId: "authority:dental:lead_generation",
      sceneTypeId:  "clinical_consultation:dental",
    }));
    expect(entry.blueprint.heroMomentId).toBe("authority:dental:lead_generation");
    expect(entry.blueprint.sceneTypeId).toBe("clinical_consultation:dental");
  });

  it("Phase 10.4I — stores emotionId and environmentId when provided", () => {
    const entry = buildMemoryEntry(minimalParams({
      heroMomentId:  "authority:dental:awareness",
      sceneTypeId:   "clinical_consultation:dental",
      emotionId:     "authority",
      environmentId: "clinical",
    }));
    expect(entry.blueprint.emotionId).toBe("authority");
    expect(entry.blueprint.environmentId).toBe("clinical");
  });

  it("Phase 10.4I — emotionId and environmentId are omitted when not provided", () => {
    const entry = buildMemoryEntry(minimalParams());
    expect(entry.blueprint.emotionId).toBeUndefined();
    expect(entry.blueprint.environmentId).toBeUndefined();
  });

  it("stores routeScore on blueprint.score", () => {
    const entry = buildMemoryEntry(minimalParams());
    expect(entry.blueprint.score.total).toBe(0.77);
  });
});

// ── Hero block ────────────────────────────────────────────────────────────────

describe("buildMemoryEntry — hero block", () => {
  it("stores heroSubjectText in hero.subject", () => {
    const entry = buildMemoryEntry(minimalParams({ heroSubjectText: "A wedding couple" }));
    expect(entry.hero.subject).toBe("A wedding couple");
  });

  it("defaults hero.source to gpt_creative_director when heroMomentId is empty", () => {
    const entry = buildMemoryEntry(minimalParams());
    expect(entry.hero.source).toBe("gpt_creative_director");
  });

  it("Phase 10.4I — sets hero.source to knowledge_graph when heroMomentId is non-empty", () => {
    const entry = buildMemoryEntry(minimalParams({
      heroMomentId: "authority:dental:lead_generation",
    }));
    expect(entry.hero.source).toBe("knowledge_graph");
  });
});

// ── Scene block ───────────────────────────────────────────────────────────────

describe("buildMemoryEntry — scene block", () => {
  it("stores environment, lighting, composition", () => {
    const entry = buildMemoryEntry(minimalParams({
      environmentText: "outdoor_urban",
      lightingText:    "golden_hour",
      compositionText: "leading_lines",
    }));
    expect(entry.scene.environment).toBe("outdoor_urban");
    expect(entry.scene.lighting).toBe("golden_hour");
    expect(entry.scene.composition).toBe("leading_lines");
  });
});

// ── Prompt block ──────────────────────────────────────────────────────────────

describe("buildMemoryEntry — prompt block", () => {
  it("stores finalPrompt and providerTarget", () => {
    const entry = buildMemoryEntry(minimalParams({
      finalPrompt:    "Cinematic shot of...",
      providerTarget: "openai_dall_e",
    }));
    expect(entry.prompt.finalPrompt).toBe("Cinematic shot of...");
    expect(entry.prompt.providerTarget).toBe("openai_dall_e");
  });

  it("sets materialTier from luxuryTier", () => {
    const entry = buildMemoryEntry(minimalParams({ luxuryTier: "luxury" }));
    expect(entry.prompt.materialTier).toBe("luxury");
  });

  it("defaults blocksPresent to empty array", () => {
    const entry = buildMemoryEntry(minimalParams());
    expect(entry.prompt.blocksPresent).toEqual([]);
  });
});

// ── Output block ──────────────────────────────────────────────────────────────

describe("buildMemoryEntry — output block", () => {
  it("fingerprint contains the selectedRouteId", () => {
    const entry = buildMemoryEntry(minimalParams({ selectedRouteId: "route-chef-authority" }));
    expect(entry.output.fingerprint).toContain("route-chef-authority");
  });

  it("Phase 10.4I — fingerprint contains real heroMomentId when provided", () => {
    const entry = buildMemoryEntry(minimalParams({
      heroMomentId: "authority:dental:lead_generation",
      sceneTypeId:  "clinical_consultation:dental",
    }));
    expect(entry.output.fingerprint).toContain("authority:dental:lead_generation");
    expect(entry.output.fingerprint).toContain("clinical_consultation:dental");
  });

  it("Phase 10.4I — two identical hero+scene+route combos produce identical fingerprints", () => {
    const p: Partial<MemoryEntryParams> = {
      heroMomentId: "authority:dental:awareness",
      sceneTypeId:  "clinical_consultation:dental",
      selectedRouteId: "route-abc",
    };
    const a = buildMemoryEntry(minimalParams(p));
    const b = buildMemoryEntry(minimalParams(p));
    expect(a.output.fingerprint).toBe(b.output.fingerprint);
  });

  it("omits projectId when not provided", () => {
    const entry = buildMemoryEntry(minimalParams());
    expect(entry.output.projectId).toBeUndefined();
  });

  it("includes projectId when provided", () => {
    const entry = buildMemoryEntry(minimalParams({ projectId: "proj-123" }));
    expect(entry.output.projectId).toBe("proj-123");
  });
});

// ── Optional fields ───────────────────────────────────────────────────────────

describe("buildMemoryEntry — optional fields", () => {
  it("has no review or feedback by default", () => {
    const entry = buildMemoryEntry(minimalParams());
    expect(entry.review).toBeUndefined();
    expect(entry.feedback).toBeUndefined();
  });
});
