// Phase 6 — Benchmark types.

import type { VariantType } from "@/lib/ai-os/prompt-variants";

export interface RatingData {
  commercialAppeal:       number; // 1–10
  storytelling:           number;
  composition:            number;
  realism:                number;
  premiumFeel:            number;
  scrollStopping:         number;
  brandFit:               number;
  marketingEffectiveness: number;
  overallScore:           number;
  notes?:                 string;
}

export interface VariantSummary {
  id:           string;
  variantType:  VariantType;
  variantLabel: string;
  focus:        string;
  finalPrompt:  string;
  promptLength: number;
  tokenCount:   number;
  status:       "pending" | "generating" | "generated" | "failed";
  imageUrl:     string | null;
  executionMs:  number | null;
  provider:     string | null;
  generatedAt:  string | null;
  errorMessage: string | null;
  rating:       RatingData | null;
}

export interface BenchmarkFull {
  id:           string;
  rawIdea:      string;
  industry:     string;
  gptMode:      "gpt" | "fallback";
  gptDirection: Record<string, unknown> | null;
  winnerId:     string | null;
  createdAt:    string;
  variants:     VariantSummary[];
}

export interface BenchmarkSummary {
  id:        string;
  rawIdea:   string;
  industry:  string;
  gptMode:   string;
  winnerId:  string | null;
  createdAt: string;
  variantCount:   number;
  generatedCount: number;
  ratedCount:     number;
}

export interface BestPerformer {
  variantId:    string;
  benchmarkId:  string;
  rawIdea:      string;
  variantLabel: string;
  finalPrompt:  string;
  imageUrl:     string | null;
  score:        number;
  ratedAt:      string;
}
