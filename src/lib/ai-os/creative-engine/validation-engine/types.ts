// Phase 10.4.0 — Validation Engine interface contract.
// NEW engine — validates final pipeline output against knowledge-driven rules.
// No predecessor in Phase 8 (validation was ad-hoc inline checks).
//
// Knowledge consumed: ValidationRuleKnowledgeNode from
//   creative-knowledge/universal/ (universal rules)
//   creative-knowledge/industries/{x}/ (industry-specific rules)
//
// Runs after Hero Generator and Route Engine, before final prompt assembly.
// Errors block generation; warnings are logged but do not block.

import type { KnowledgeStore } from "../../creative-knowledge/store";
import type { PipelineContext, KnowledgeTrace } from "../types";

export interface ValidationEngineInput extends PipelineContext {
  /** Subject text that will appear in the HERO block. */
  heroSubject:   string;
  /** Archetype ID selected by Archetype Selector. */
  archetypeId:   string;
  /** Hero moment ID from Hero Generator. */
  heroMomentId:  string;
  /** Route ID from Route Engine. */
  routeId:       string;
  /** All assembled prompt block key → value pairs for rule matching. */
  promptBlocks:  Record<string, string>;
}

export type ViolationSeverity = "error" | "warning";

export interface ValidationViolation {
  /** Matches ValidationRuleKnowledgeNode.id. */
  ruleId:      string;
  severity:    ViolationSeverity;
  description: string;
  /** Which prompt field or block triggered this violation. */
  field:       string;
}

export interface ValidationEngineOutput {
  /** False only if at least one "error" severity violation is present. */
  valid:      boolean;
  /** Severity "error" violations — these block generation. */
  violations: ValidationViolation[];
  /** Severity "warning" violations — logged but generation continues. */
  warnings:   ValidationViolation[];
  trace:      KnowledgeTrace;
}

export type ValidationEngineRunner = (
  input: ValidationEngineInput,
  store: KnowledgeStore,
) => ValidationEngineOutput;
