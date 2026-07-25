import { describe, expect, it } from "vitest";
import { resolveHeroGraphMeta } from "./hero-knowledge-graph";
import type { HeroKnowledgeGraphMeta } from "./types";

// Phase 10.4I — Hero Knowledge Graph tests.
// Verifies that resolveHeroGraphMeta() always returns non-empty, deterministic IDs.

describe("resolveHeroGraphMeta — ID contract (Phase 10.4I)", () => {
  it("returns non-empty heroMomentId for every heroType", () => {
    const heroTypes = ["authority", "person", "product", "environment", "transformation", "data", "lifestyle", "moment"] as const;
    for (const heroType of heroTypes) {
      const meta = resolveHeroGraphMeta(heroType, "dental", "lead_generation");
      expect(meta.heroMomentId).not.toBe("");
      expect(meta.heroMomentId.length).toBeGreaterThan(0);
    }
  });

  it("returns non-empty sceneTypeId for every heroType", () => {
    const heroTypes = ["authority", "person", "product", "environment", "transformation", "data", "lifestyle", "moment"] as const;
    for (const heroType of heroTypes) {
      const meta = resolveHeroGraphMeta(heroType, "dental", "lead_generation");
      expect(meta.sceneTypeId).not.toBe("");
    }
  });

  it("is deterministic — same inputs always produce the same IDs", () => {
    const a = resolveHeroGraphMeta("authority", "dental", "lead_generation");
    const b = resolveHeroGraphMeta("authority", "dental", "lead_generation");
    expect(a.heroMomentId).toBe(b.heroMomentId);
    expect(a.sceneTypeId).toBe(b.sceneTypeId);
    expect(a.visualFingerprint).toBe(b.visualFingerprint);
  });

  it("produces different heroMomentId for different heroTypes", () => {
    const authority = resolveHeroGraphMeta("authority", "dental", "awareness");
    const person    = resolveHeroGraphMeta("person", "dental", "awareness");
    expect(authority.heroMomentId).not.toBe(person.heroMomentId);
  });

  it("produces different heroMomentId for different industries", () => {
    const dental   = resolveHeroGraphMeta("authority", "dental", "awareness");
    const finance  = resolveHeroGraphMeta("authority", "finance", "awareness");
    expect(dental.heroMomentId).not.toBe(finance.heroMomentId);
  });

  it("produces different heroMomentId for different campaign types", () => {
    const awareness = resolveHeroGraphMeta("authority", "dental", "awareness");
    const leads     = resolveHeroGraphMeta("authority", "dental", "lead_generation");
    expect(awareness.heroMomentId).not.toBe(leads.heroMomentId);
  });

  it("encodes heroMomentId as heroType:industry:campaignType", () => {
    const meta = resolveHeroGraphMeta("authority", "dental", "lead_generation");
    expect(meta.heroMomentId).toBe("authority:dental:lead_generation");
  });

  it("sets heroCategory equal to heroType", () => {
    const meta = resolveHeroGraphMeta("person", "restaurant", "awareness");
    expect(meta.heroCategory).toBe("person");
  });

  it("sets sceneCategory to a non-empty string", () => {
    const meta = resolveHeroGraphMeta("authority", "dental", "awareness");
    expect(meta.sceneCategory).not.toBe("");
    expect(meta.sceneCategory).toBe("clinical");
  });

  it("resolves known industry-specific sceneTypeId for authority:dental", () => {
    const meta = resolveHeroGraphMeta("authority", "dental", "awareness");
    expect(meta.sceneTypeId).toBe("clinical_consultation:dental");
  });

  it("falls back gracefully for unknown industry", () => {
    const meta = resolveHeroGraphMeta("authority", "unknown_sector", "awareness");
    expect(meta.heroMomentId).toBe("authority:unknown_sector:awareness");
    expect(meta.sceneTypeId).not.toBe("");
    expect(meta.sceneCategory).toBe("clinical");
  });

  it("substitutes 'general' for empty industryKey and campaignType", () => {
    const meta = resolveHeroGraphMeta("person", "", "");
    expect(meta.heroMomentId).toBe("person:general:general");
    expect(meta.industryKey).toBe("general");
    expect(meta.campaignType).toBe("general");
  });

  it("returns all 9 required fields with no undefined values", () => {
    const meta: HeroKnowledgeGraphMeta = resolveHeroGraphMeta("lifestyle", "automotive", "awareness");
    const requiredKeys: (keyof HeroKnowledgeGraphMeta)[] = [
      "heroMomentId", "heroFamilyId", "heroCategory",
      "sceneTypeId", "sceneFamily", "sceneCategory",
      "industryKey", "campaignType", "visualFingerprint",
    ];
    for (const key of requiredKeys) {
      expect(meta[key], `${key} should not be undefined`).toBeDefined();
      expect(meta[key], `${key} should not be empty`).not.toBe("");
    }
  });
});
