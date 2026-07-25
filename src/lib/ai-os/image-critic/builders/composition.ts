import type { ImageCriticInput, CompositionEvaluation, EvaluationField, EvaluationScore } from "../types";
import { ef } from "../types";
import { COMPOSITION_PRINCIPLE_SCORES } from "../knowledge";

// Domain 2 — Composition Evaluation.
// Evaluates whether the composition was rendered as specified.
// Source: spec_inference + rule_based

function buildRuleOfThirds(input: ImageCriticInput): EvaluationField<"applied" | "partially_applied" | "not_applied" | "unknown"> {
  const comp = input.promptSpec?.composition;
  if (!comp) return ef("unknown", "low", "No composition specification found", "spec_inference");

  const principle = comp.primaryComposition?.value ?? "";

  if (principle.includes("rule_of_thirds") || principle.includes("thirds")) {
    return ef("applied", "medium",
      `Composition spec requested "${principle}" — rule of thirds was specified and is expected to be applied`,
      "spec_inference");
  }
  if (principle.includes("golden") || principle.includes("centered") || principle.includes("symmetri")) {
    return ef("partially_applied", "low",
      `Composition spec "${principle}" — rule of thirds not explicitly specified; may be partially applied`,
      "spec_inference");
  }

  return ef("unknown", "low",
    "Composition principle does not specify rule of thirds; evaluation requires vision analysis",
    "spec_inference");
}

function buildVisualBalance(input: ImageCriticInput): EvaluationField<"balanced" | "slightly_unbalanced" | "unbalanced" | "unknown"> {
  const comp = input.promptSpec?.composition;
  if (!comp) return ef("unknown", "low", "No composition specification found", "spec_inference");

  const balance = comp.visualBalance?.value ?? "";

  if (balance.includes("balanced") || balance.includes("symmetric") || balance.includes("equal")) {
    return ef("balanced", "medium",
      `Visual balance specified as "${balance}" — composition designed to be balanced`,
      "spec_inference");
  }
  if (balance.includes("dynamic") || balance.includes("asymmetr") || balance.includes("tension")) {
    return ef("slightly_unbalanced", "medium",
      `Visual balance "${balance}" — intentional asymmetry; not a defect`,
      "spec_inference");
  }

  return ef("unknown", "low",
    `Balance principle "${balance}" could not be mapped — vision analysis required`,
    "spec_inference");
}

function buildNegativeSpace(input: ImageCriticInput): EvaluationField<"appropriate" | "insufficient" | "excessive" | "unknown"> {
  const comp    = input.promptSpec?.composition;
  const layout  = input.blueprint?.layout;

  if (!comp) return ef("unknown", "low", "No composition or scene plan available", "spec_inference");

  const negSpace   = comp?.negativeSpace?.value ?? "";
  const heroScale  = (input.scenePlan?.heroSubject as { heroScale?: { value?: string } } | undefined)?.heroScale?.value ?? "";
  const density    = (layout as { visualDensity?: { value?: string } } | undefined)?.visualDensity?.value ?? "";

  if (density === "minimal" || negSpace.includes("abundant") || negSpace.includes("generous")) {
    return ef("appropriate", "medium",
      `Negative space designed as "${negSpace}" with density "${density}" — appropriate negative space expected`,
      "spec_inference");
  }
  if (density === "dense" || density === "high" || heroScale === "full_frame_dominant") {
    return ef("insufficient", "low",
      `Dense composition (density: "${density}", hero scale: "${heroScale}") — negative space will be limited by design`,
      "spec_inference");
  }

  return ef("appropriate", "low", "Negative space assumed appropriate based on spec", "spec_inference");
}

function buildDepth(input: ImageCriticInput): EvaluationField<"good_depth" | "flat" | "unknown"> {
  const comp  = input.promptSpec?.composition;
  const scene = input.scenePlan?.environment;

  const fg = comp?.foreground?.value ?? scene?.foreground?.value ?? "";
  const mg = comp?.midground?.value ?? scene?.midground?.value ?? "";
  const bg = comp?.background?.value ?? scene?.background?.value ?? "";

  const hasMultiplePlanes = [fg, mg, bg].filter(v => v && v !== "none" && v !== "not_applicable").length >= 2;

  if (hasMultiplePlanes) {
    return ef("good_depth", "medium",
      "Multiple depth planes specified (foreground, midground, background) — image should have dimensional depth",
      "spec_inference");
  }

  const envType = scene?.environmentType?.value ?? "";
  if (envType.includes("studio") || envType.includes("gradient") || envType.includes("abstract")) {
    return ef("flat", "medium",
      `Studio/abstract environment "${envType}" typically produces flat, controlled backgrounds by design`,
      "spec_inference");
  }

  return ef("unknown", "low", "Depth cannot be determined from spec alone", "spec_inference");
}

function buildVisualHierarchy(input: ImageCriticInput): EvaluationField<"clear_hierarchy" | "unclear_hierarchy" | "unknown"> {
  const heroSpec   = input.promptSpec?.hero;
  const layout     = input.blueprint?.layout;

  const importance = (heroSpec?.heroImportance?.value ?? "") as string;
  const hierarchy  = (layout as { visualHierarchy?: { value?: string } } | undefined)?.visualHierarchy?.value ?? "";

  if (importance === "absolute_mandatory" || importance === "primary_anchor" || hierarchy.includes("clear")) {
    return ef("clear_hierarchy", "medium",
      `Hero importance "${importance}" — visual hierarchy is designed to be clear`,
      "spec_inference");
  }
  if (importance === "contextual_element") {
    return ef("unclear_hierarchy", "low",
      "Hero is a contextual element — hierarchy may not be immediately clear",
      "spec_inference");
  }

  return ef("unknown", "low", "Hierarchy cannot be fully determined without vision analysis", "spec_inference");
}

function buildCompositionScore(
  ruleOfThirds:    EvaluationField<string>,
  visualBalance:   EvaluationField<string>,
  negativeSpace:   EvaluationField<string>,
  depth:           EvaluationField<string>,
  visualHierarchy: EvaluationField<string>,
  input:           ImageCriticInput
): EvaluationScore {
  const comp = input.promptSpec?.composition;
  const principle = comp?.primaryComposition?.value ?? "default";
  const baseScore = COMPOSITION_PRINCIPLE_SCORES[principle] ?? COMPOSITION_PRINCIPLE_SCORES["default"];

  // Adjust for hierarchy
  const hierarchyAdj = visualHierarchy.value === "clear_hierarchy" ? 5
    : visualHierarchy.value === "unclear_hierarchy" ? -5 : 0;

  const score = Math.min(100, Math.max(0, Math.round(baseScore + hierarchyAdj)));

  return ef(
    score,
    "low",
    `Composition score ${score}/100 — based on principle "${principle}" (base ${baseScore}) + hierarchy adjustment ${hierarchyAdj}. Spec-inference only.`,
    "rule_based"
  );
}

export function buildCompositionEvaluation(input: ImageCriticInput): CompositionEvaluation {
  const ruleOfThirds  = buildRuleOfThirds(input);
  const visualBalance = buildVisualBalance(input);
  const negativeSpace = buildNegativeSpace(input);
  const depth         = buildDepth(input);
  const visualHierarchy = buildVisualHierarchy(input);
  const compositionScore = buildCompositionScore(
    ruleOfThirds, visualBalance, negativeSpace, depth, visualHierarchy, input
  );

  return { ruleOfThirds, visualBalance, negativeSpace, depth, visualHierarchy, compositionScore };
}
