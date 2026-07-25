import type { CreativeStrategy } from "../../creative-brain/types";
import type { VisualLayoutPlan } from "../../visual-layout/types";
import type { ReadabilityIntelligence } from "../types";
import { tf } from "./shared";
import { getReadabilityRule } from "../knowledge";

// Builder 5 — Readability Intelligence
// Sole responsibility: determine the constraints that ensure text
// is legible and accessible at the correct reading distance and speed.

export function buildReadabilityIntelligence(
  strategy: CreativeStrategy,
  layout: VisualLayoutPlan
): ReadabilityIntelligence {
  const platform = strategy.platform.primaryPlatform.value;
  const canvasType = layout.canvas.canvasType.value;
  const rule = getReadabilityRule(platform !== "unknown" ? platform : "general");

  const maxCharsPerHeadlineLine = tf(
    rule.maxHeadlineWords as ReadabilityIntelligence["maxCharsPerHeadlineLine"]["value"],
    platform !== "unknown" ? "high" : "medium",
    `Platform "${platform}" headline length rule: ${rule.maxHeadlineWords}`
  );

  const maxLinesForHeroHeadline = tf(
    rule.maxHeadlineLines as ReadabilityIntelligence["maxLinesForHeroHeadline"]["value"],
    "high",
    `Platform "${platform}" allows maximum ${rule.maxHeadlineLines} for the hero headline`
  );

  const maxLinesForBody = tf(
    rule.maxBodyLines as ReadabilityIntelligence["maxLinesForBody"]["value"],
    "high",
    `Platform "${platform}" body copy constraint: ${rule.maxBodyLines}`
  );

  const readingSpeed = tf(
    rule.readingSpeed as ReadabilityIntelligence["readingSpeed"]["value"],
    "high",
    `Platform "${platform}" reading speed: ${rule.readingSpeed} — all text must communicate within this window`
  );

  const mobileReadabilityNote = tf(rule.mobileNote, "high",
    `Mobile readability requirement for platform "${platform}"`);

  const desktopReadabilityNote = tf(rule.desktopNote, "high",
    `Desktop readability requirement for platform "${platform}"`);

  const minimumTextSizeCategory = (() => {
    const minCat = rule.minSizeCategory;
    if (canvasType === "outdoor_billboard") return tf("headline_minimum_only", "high",
      `Outdoor billboard: only headline text is viable; body and labels will not be legible from distance`);
    return tf(
      minCat as ReadabilityIntelligence["minimumTextSizeCategory"]["value"],
      "high",
      `Minimum text size category for "${canvasType}" canvas on "${platform}" platform`
    );
  })();

  return { maxCharsPerHeadlineLine, maxLinesForHeroHeadline, maxLinesForBody, readingSpeed, mobileReadabilityNote, desktopReadabilityNote, minimumTextSizeCategory };
}
