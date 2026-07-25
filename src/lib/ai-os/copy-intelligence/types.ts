// Phase 8.8A — Copy Intelligence Engine types.
// All interfaces for commercial copy generation.
// No prompts. No layouts. No typography. Only structured marketing copy.

import type { SupportedIndustryId, CommercialObjective, BrandType } from "../commercial-assets/types";

// ─────────────────────────────────────────────────────────────────────────────
// Tone
// ─────────────────────────────────────────────────────────────────────────────

export type ToneType = "luxury" | "premium" | "professional" | "friendly" | "authoritative" | "minimal";
export type FormLevel = "formal" | "semi_formal" | "casual";
export type EnergyLevel = "high" | "medium" | "low";

export interface ToneProfile {
  primary: ToneType;
  secondary: ToneType | null;
  formality: FormLevel;
  energyLevel: EnergyLevel;
}

// ─────────────────────────────────────────────────────────────────────────────
// Headline
// ─────────────────────────────────────────────────────────────────────────────

export interface HeadlineCandidate {
  text: string;
  score: number; // 0–100
  rationale: string;
}

export interface HeadlineResult {
  best: string;
  alternates: string[];
  candidates: HeadlineCandidate[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Commercial Copy output
// ─────────────────────────────────────────────────────────────────────────────

export interface CommercialCopy {
  headline: string;
  subheadline: string | null;
  benefits: string[];        // each ≤ 6 words
  cta: string;
  secondaryCta: string | null;
  socialProof: string[];
  offer: string | null;
  badge: string | null;
  disclaimer: string | null;
  alternateHeadlines: string[];
  tone: ToneProfile;
  metadata: CopyMetadata;
}

export interface CopyMetadata {
  industry: SupportedIndustryId;
  objective: CommercialObjective;
  brandType: BrandType;
  headlineWordCount: number;
  benefitCount: number;
  hasOffer: boolean;
  hasDisclaimer: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine input
// ─────────────────────────────────────────────────────────────────────────────

export interface CopyInput {
  rawIdea: string;
  industry: SupportedIndustryId;
  campaignCategory: string;
  audience: string;
  commercialObjective: CommercialObjective;
  brandType: BrandType;
  communicationStyle: string;
  offer: string | null;
  mandatoryAssets: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: headline template definition
// ─────────────────────────────────────────────────────────────────────────────

export interface HeadlineTemplate {
  pattern: string;
  tones: ToneType[];
  objectives: CommercialObjective[];
  industries?: SupportedIndustryId[];
  baseScore: number;
}
