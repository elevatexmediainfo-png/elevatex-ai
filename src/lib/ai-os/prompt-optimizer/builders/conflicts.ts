import type { PromptSpecification } from "../../prompt-spec/types";
import type { ConflictReport, ConflictItem } from "../types";

// Builder 4 — Conflict Detection
// Detects contradictory instructions within the PromptSpecification.
// Returns structured conflicts with severity and resolution guidance.

export function buildConflictReport(spec: PromptSpecification): ConflictReport {
  const conflicts: ConflictItem[] = [];

  const luxuryLevel = spec.rendering.luxuryLevel.value ?? "";
  const negativeSpace = spec.composition.negativeSpace.value ?? "";
  const photorealism = spec.rendering.photorealismLevel.value ?? "";
  const moodLighting = spec.lighting.moodLighting.value ?? "";
  const envType = spec.environment.environmentType.value ?? "";
  const cameraHeight = spec.camera.cameraHeight.value ?? "";
  const lensIntent = spec.camera.lensIntent.value ?? "";
  const requiredObjects = spec.supporting.requiredObjects.value ?? "";
  const heroExpression = spec.hero.heroDetails.value ?? "";
  const heroSubject = spec.hero.heroSubject.value ?? "";

  // Conflict 1: Luxury + Information Dense
  if ((luxuryLevel.includes("luxury") || luxuryLevel.includes("ultra")) &&
      negativeSpace.includes("tight")) {
    conflicts.push({
      severity: "critical",
      field1: "rendering.luxuryLevel",
      value1: luxuryLevel,
      field2: "composition.negativeSpace",
      value2: negativeSpace,
      description: "Luxury positioning requires generous negative space, but composition specifies tight/minimal space",
      resolution: "Resolve in favour of luxury: increase negative space. Luxury = restraint, not density.",
    });
  }

  // Conflict 2: Outdoor environment + Studio lighting
  if ((envType.includes("outdoor") || envType.includes("natural")) &&
      (moodLighting.includes("studio") || moodLighting.includes("clinical") || moodLighting.includes("precise"))) {
    conflicts.push({
      severity: "warning",
      field1: "environment.environmentType",
      value1: envType,
      field2: "lighting.moodLighting",
      value2: moodLighting,
      description: "Outdoor environment with clinical/studio-style lighting creates an inconsistency — outdoor light is directional, not controlled",
      resolution: "If outdoors is required, soften lighting to 'natural_authentic_ambient'. If studio lighting is required, change environment to studio/interior.",
    });
  }

  // Conflict 3: Overhead camera + Portrait lens intent
  if (cameraHeight.includes("overhead") && lensIntent.includes("portrait")) {
    conflicts.push({
      severity: "warning",
      field1: "camera.cameraHeight",
      value1: cameraHeight,
      field2: "camera.lensIntent",
      value2: lensIntent,
      description: "Overhead (flat-lay) camera height is incompatible with portrait lens intent — portrait lenses are used for eye-level subject photography",
      resolution: "Use macro_intimate_detail or wide_environmental lens intent for overhead shots.",
    });
  }

  // Conflict 4: not_applicable_product expression + human-connection marketing
  if (heroExpression.includes("not_applicable_product") &&
      (spec.marketing.conversionIntent.value ?? "").toLowerCase().includes("human")) {
    conflicts.push({
      severity: "suggestion",
      field1: "hero.heroDetails",
      value1: "not_applicable_product (no human subject)",
      field2: "marketing.conversionIntent",
      value2: spec.marketing.conversionIntent.value,
      description: "Product-only scene may be less effective for campaigns requiring human emotional connection",
      resolution: "Consider adding an incidental human element to create connection without competing with the product hero.",
    });
  }

  // Conflict 5: hyperrealistic + stylized composition elements
  if (photorealism === "hyperrealistic" &&
      (negativeSpace.includes("extreme") || negativeSpace.includes("ultra"))) {
    conflicts.push({
      severity: "suggestion",
      field1: "rendering.photorealismLevel",
      value1: photorealism,
      field2: "composition.negativeSpace",
      value2: negativeSpace,
      description: "Hyperrealistic rendering with extreme negative space (luxury minimal composition) can create tension — hyperrealism benefits from texture-rich environments, not emptiness",
      resolution: "Consider reducing to 'photorealistic' + generous_editorial_space combination for better coherence.",
    });
  }

  // Conflict 6: Dense required objects + minimal/luxury space
  const manyObjects = requiredObjects.split(",").length > 4;
  if (manyObjects && (luxuryLevel.includes("luxury") || luxuryLevel.includes("ultra"))) {
    conflicts.push({
      severity: "warning",
      field1: "supporting.requiredObjects",
      value1: `${requiredObjects.split(",").length} required objects`,
      field2: "rendering.luxuryLevel",
      value2: luxuryLevel,
      description: "Many required objects conflict with luxury minimal aesthetic — luxury compositions use very few, perfectly placed elements",
      resolution: "Reduce required objects to the 2-3 most important. Luxury is editorial, not encyclopedic.",
    });
  }

  // Conflict 7: Hero = product + human hero expression
  if ((heroSubject.toLowerCase().includes("product") || heroSubject.toLowerCase().includes("ring") ||
       heroSubject.toLowerCase().includes("car") || heroSubject.toLowerCase().includes("dish")) &&
       spec.hero.heroDetails.value.includes("smile")) {
    conflicts.push({
      severity: "warning",
      field1: "hero.heroSubject",
      value1: heroSubject.slice(0, 60),
      field2: "hero.heroDetails",
      value2: "expression involving smile",
      description: "Product hero subject combined with human expression details creates ambiguity about the primary subject",
      resolution: "If product is the hero, set hero expression to not_applicable_product. Human elements become supporting subjects.",
    });
  }

  const criticalCount = conflicts.filter(c => c.severity === "critical").length;
  const warningCount = conflicts.filter(c => c.severity === "warning").length;
  const suggestionCount = conflicts.filter(c => c.severity === "suggestion").length;

  return { totalFound: conflicts.length, criticalCount, warningCount, suggestionCount, conflicts };
}
