// Phase 8.8A — Disclaimer Engine.
// Generates legally required disclaimers for regulated industries.
// Deterministic — no LLM. Only produces text when legally required.

import type { SupportedIndustryId } from "../commercial-assets/types";
import { INDUSTRY_DISCLAIMERS, DISCLAIMER_INDUSTRIES } from "./industry-rules";

export function requiresDisclaimer(industry: SupportedIndustryId): boolean {
  return DISCLAIMER_INDUSTRIES.has(industry);
}

export function getDisclaimer(industry: SupportedIndustryId): string | null {
  if (!requiresDisclaimer(industry)) return null;
  return INDUSTRY_DISCLAIMERS[industry] ?? null;
}
