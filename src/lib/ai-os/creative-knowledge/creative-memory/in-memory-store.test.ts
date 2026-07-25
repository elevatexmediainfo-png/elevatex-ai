import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryStore } from "./in-memory-store";
import type { CreativeMemoryEntry } from "./types";
import type { SceneIndustry }       from "../../prompt-spec/scene-builder";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<CreativeMemoryEntry> = {}): CreativeMemoryEntry {
  const base: CreativeMemoryEntry = {
    id:        crypto.randomUUID(),
    userId:    "user-1",
    timestamp: new Date("2026-07-01T12:00:00Z"),
    input: {
      rawIdea:      "Dental implant promo",
      industry:     "dental" as SceneIndustry,
      campaignGoal: "awareness",
      luxuryTier:   "mid",
      signals: {
        industry:     "dental" as SceneIndustry,
        campaignGoal: "awareness",
        rawIdea:      "Dental implant promo",
      },
    },
    blueprint: {
      selectedRouteId: "route-a",
      archetypeId:     "",
      heroMomentId:    "",
      sceneTypeId:     "",
      score: {
        relevance: 0.8, diversity: 0.9, industryFit: 0.7,
        tierMatch: 0.6, seasonalBoost: 0.5, total: 0.7,
      },
    },
    hero:    { subject: "Dentist in white coat", source: "gpt_creative_director" },
    scene:   { environment: "professional_studio", lighting: "soft_natural", composition: "rule_of_thirds" },
    prompt:  { finalPrompt: "A dentist...", providerTarget: "fal_flux", blocksPresent: [], realismApplied: false, materialTier: "mid" },
    output:  { generatedAt: new Date("2026-07-01T12:00:00Z"), fingerprint: "none|none|route-a|none|none|dental" },
    diversity: {
      heroId: "", archetypeId: "", sceneId: "", behaviourIds: [], relationshipIds: [],
      layoutId: "", cameraId: "", lightingId: "", compositionId: "",
      fingerprint: "none|none|none|none",
    },
  };
  return { ...base, ...overrides };
}

// ── save / getById ────────────────────────────────────────────────────────────

describe("InMemoryStore — save and getById", () => {
  it("saves and retrieves an entry by id", async () => {
    const store = new InMemoryStore();
    const entry = makeEntry();
    await store.save(entry);
    const retrieved = await store.getById(entry.id);
    expect(retrieved).toEqual(entry);
  });

  it("returns null for unknown id", async () => {
    const store = new InMemoryStore();
    expect(await store.getById("not-a-real-id")).toBeNull();
  });

  it("throws when saving duplicate id", async () => {
    const store = new InMemoryStore();
    const entry = makeEntry();
    await store.save(entry);
    await expect(store.save(entry)).rejects.toThrow();
  });
});

// ── update ────────────────────────────────────────────────────────────────────

describe("InMemoryStore — update", () => {
  it("patches the review field", async () => {
    const store = new InMemoryStore();
    const entry = makeEntry();
    await store.save(entry);
    const review = { reviewedAt: new Date(), isOnBrief: true };
    await store.update(entry.id, { review });
    const updated = await store.getById(entry.id);
    expect(updated?.review).toEqual(review);
  });

  it("does not touch other fields during update", async () => {
    const store = new InMemoryStore();
    const entry = makeEntry();
    await store.save(entry);
    await store.update(entry.id, { feedback: { rating: 5, regenerated: false, timestamp: new Date() } });
    const updated = await store.getById(entry.id);
    expect(updated?.blueprint.selectedRouteId).toBe("route-a");
  });

  it("throws when updating non-existent id", async () => {
    const store = new InMemoryStore();
    await expect(store.update("ghost-id", { review: undefined })).rejects.toThrow();
  });
});

// ── query ─────────────────────────────────────────────────────────────────────

describe("InMemoryStore — query", () => {
  it("filters by userId", async () => {
    const store = new InMemoryStore();
    await store.save(makeEntry({ userId: "alice" }));
    await store.save(makeEntry({ userId: "bob" }));
    const results = await store.query({ userId: "alice" });
    expect(results).toHaveLength(1);
    expect(results[0].userId).toBe("alice");
  });

  it("filters by industry", async () => {
    const store = new InMemoryStore();
    const dental = makeEntry();
    const restaurant = makeEntry({
      input: { ...dental.input, industry: "restaurant" as SceneIndustry },
    });
    await store.save(dental);
    await store.save(restaurant);
    const results = await store.query({ industry: "dental" as SceneIndustry });
    expect(results).toHaveLength(1);
    expect(results[0].input.industry).toBe("dental");
  });

  it("sorts by date descending by default", async () => {
    const store = new InMemoryStore();
    const older = makeEntry({ timestamp: new Date("2026-06-01") });
    const newer = makeEntry({ timestamp: new Date("2026-07-01") });
    await store.save(older);
    await store.save(newer);
    const results = await store.query({});
    expect(results[0].timestamp.getTime()).toBeGreaterThan(results[1].timestamp.getTime());
  });

  it("respects limit", async () => {
    const store = new InMemoryStore();
    for (let i = 0; i < 5; i++) await store.save(makeEntry());
    const results = await store.query({ limit: 2 });
    expect(results).toHaveLength(2);
  });

  it("returns empty array when no entries match", async () => {
    const store = new InMemoryStore();
    expect(await store.query({ userId: "nobody" })).toEqual([]);
  });
});

// ── getRecent ─────────────────────────────────────────────────────────────────

describe("InMemoryStore — getRecent", () => {
  it("returns N most recent entries for user + industry", async () => {
    const store = new InMemoryStore();
    for (let i = 0; i < 7; i++) {
      await store.save(makeEntry({ timestamp: new Date(2026, 6, i + 1) }));
    }
    const results = await store.getRecent("user-1", "dental" as SceneIndustry, 3);
    expect(results).toHaveLength(3);
    expect(results[0].timestamp.getDate()).toBe(7);
  });

  it("ignores entries from other users", async () => {
    const store = new InMemoryStore();
    await store.save(makeEntry({ userId: "alice" }));
    await store.save(makeEntry({ userId: "bob" }));
    const results = await store.getRecent("alice", "dental" as SceneIndustry, 5);
    expect(results).toHaveLength(1);
  });
});

// ── getRecentFingerprints ─────────────────────────────────────────────────────

describe("InMemoryStore — getRecentFingerprints", () => {
  it("returns hashes in exploration-avoidance format", async () => {
    const store = new InMemoryStore();
    const entry = makeEntry();
    await store.save(entry);
    const hashes = await store.getRecentFingerprints("user-1", "dental" as SceneIndustry, 5);
    // heroMomentId = "", sceneTypeId = "", selectedRouteId = "route-a"
    expect(hashes[0]).toBe("none|none|route-a");
  });

  it("returns hashes in date descending order", async () => {
    const store = new InMemoryStore();
    const old = makeEntry({ timestamp: new Date("2026-06-01"), blueprint: { ...makeEntry().blueprint, selectedRouteId: "route-old" } });
    const fresh = makeEntry({ timestamp: new Date("2026-07-01"), blueprint: { ...makeEntry().blueprint, selectedRouteId: "route-fresh" } });
    await store.save(old);
    await store.save(fresh);
    const hashes = await store.getRecentFingerprints("user-1", "dental" as SceneIndustry, 5);
    expect(hashes[0]).toContain("route-fresh");
    expect(hashes[1]).toContain("route-old");
  });

  it("populates heroMomentId and sceneTypeId when present", async () => {
    const store = new InMemoryStore();
    const entry = makeEntry({
      blueprint: {
        ...makeEntry().blueprint,
        heroMomentId: "hero-123",
        sceneTypeId:  "scene-456",
        selectedRouteId: "route-a",
      },
    });
    await store.save(entry);
    const hashes = await store.getRecentFingerprints("user-1", "dental" as SceneIndustry, 5);
    expect(hashes[0]).toBe("hero-123|scene-456|route-a");
  });
});

// ── getCommercialHistory ──────────────────────────────────────────────────────

describe("InMemoryStore — getCommercialHistory", () => {
  it("returns zero history when no entries exist", async () => {
    const store = new InMemoryStore();
    const history = await store.getCommercialHistory({
      userId: "user-1", industry: "dental" as SceneIndustry,
    });
    expect(history.totalGenerations).toBe(0);
    expect(history.successRate).toBeNull();
  });

  it("computes correct success rate", async () => {
    const store = new InMemoryStore();
    const success = makeEntry({ review: { reviewedAt: new Date(), isOnBrief: true } });
    const failure = makeEntry({ review: { reviewedAt: new Date(), isOnBrief: false } });
    await store.save(success);
    await store.save(failure);
    const history = await store.getCommercialHistory({
      userId: "user-1", industry: "dental" as SceneIndustry,
    });
    expect(history.totalGenerations).toBe(2);
    expect(history.successfulGenerations).toBe(1);
    expect(history.successRate).toBe(0.5);
  });

  it("includes topRouteIds sorted by success rate", async () => {
    const store = new InMemoryStore();
    const good = makeEntry({
      blueprint: { ...makeEntry().blueprint, selectedRouteId: "route-good" },
      review:    { reviewedAt: new Date(), isOnBrief: true },
    });
    const bad = makeEntry({
      blueprint: { ...makeEntry().blueprint, selectedRouteId: "route-bad" },
      review:    { reviewedAt: new Date(), isOnBrief: false },
    });
    await store.save(good);
    await store.save(bad);
    const history = await store.getCommercialHistory({
      userId: "user-1", industry: "dental" as SceneIndustry,
    });
    expect(history.topRouteIds[0]).toBe("route-good");
  });
});

// ── searchSimilar (Phase 10.4I — real hero/scene/emotion/environment IDs) ────

describe("InMemoryStore — searchSimilar", () => {
  it("returns 'proceed' when store is empty", async () => {
    const store = new InMemoryStore();
    const { buildEmptyFingerprint } = await import("./fingerprint");
    const fp = buildEmptyFingerprint("dental" as SceneIndustry, "awareness", "mid", "route-x");
    const result = await store.searchSimilar({ targetFingerprint: fp, scope: "last_5" });
    expect(result.recommendation).toBe("proceed");
    expect(result.maxSimilarity).toBe(0);
  });

  it("returns 'proceed' for different routes when no hero/scene IDs are set", async () => {
    const store = new InMemoryStore();
    await store.save(makeEntry());
    const { buildEmptyFingerprint } = await import("./fingerprint");
    const fp = buildEmptyFingerprint("dental" as SceneIndustry, "awareness", "mid", "route-different");
    const result = await store.searchSimilar({ targetFingerprint: fp, scope: "last_5" });
    // Without hero/scene/emotion/environment IDs the route dimension is
    // only 0.10 (Phase 10.4I weights) — below soft threshold 0.60.
    expect(result.recommendation).toBe("proceed");
  });

  it("Phase 10.4I — same heroMomentId+sceneTypeId scores above soft threshold", async () => {
    const store = new InMemoryStore();
    const entry = makeEntry({
      blueprint: {
        ...makeEntry().blueprint,
        heroMomentId: "authority:dental:lead_generation",
        sceneTypeId:  "clinical_consultation:dental",
        emotionId:    "authority",
        environmentId:"clinical",
        selectedRouteId: "route-a",
      },
    });
    await store.save(entry);
    const { buildFingerprint } = await import("./fingerprint");
    const fp = buildFingerprint({
      heroId:          "authority:dental:lead_generation",
      sceneId:         "clinical_consultation:dental",
      emotionId:       "authority",
      environmentId:   "clinical",
      behaviourIds:    [],
      relationshipIds: [],
      layoutId:        "",
      cameraId:        "",
      lightingId:      "",
      compositionId:   "",
      routeId:         "route-a",
      archetypeIds:    [],
      psychologyIds:   [],
      industryId:      "dental" as SceneIndustry,
      campaignGoal:    "awareness",
      luxuryTier:      "mid",
    });
    const result = await store.searchSimilar({ targetFingerprint: fp, scope: "last_5" });
    // hero(0.20) + scene(0.15) + emotion(0.12) + environment(0.10) + route(0.10) = 0.67 > soft(0.60)
    expect(result.maxSimilarity).toBeGreaterThan(0.60);
    expect(["diversify", "reject"]).toContain(result.recommendation);
  });

  it("Phase 10.4I — different heroMomentId but same sceneCategory still scores emotion dimension", async () => {
    const store = new InMemoryStore();
    const entry = makeEntry({
      blueprint: {
        ...makeEntry().blueprint,
        heroMomentId:  "authority:dental:awareness",
        sceneTypeId:   "clinical_consultation:dental",
        emotionId:     "authority",
        environmentId: "clinical",
        selectedRouteId: "route-a",
      },
    });
    await store.save(entry);
    const { buildFingerprint } = await import("./fingerprint");
    const fp = buildFingerprint({
      heroId:          "authority:dental:lead_generation",
      sceneId:         "clinical_consultation:dental",
      emotionId:       "authority",
      environmentId:   "clinical",
      behaviourIds:    [],
      relationshipIds: [],
      layoutId:        "",
      cameraId:        "",
      lightingId:      "",
      compositionId:   "",
      routeId:         "route-b",
      archetypeIds:    [],
      psychologyIds:   [],
      industryId:      "dental" as SceneIndustry,
      campaignGoal:    "awareness",
      luxuryTier:      "mid",
    });
    const result = await store.searchSimilar({ targetFingerprint: fp, scope: "last_5" });
    const dims = result.matches[0]?.dimensionScores;
    // emotion and environment should score 1.0 (same category)
    expect(dims?.emotion).toBe(1.0);
    expect(dims?.environment).toBe(1.0);
    // heroId differs → hero should score 0.0
    expect(dims?.hero).toBe(0.0);
  });
});
