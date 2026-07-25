import type { CreativeStrategy } from "../../creative-brain/types";
import type { CanvasPlanning } from "../types";
import { lf } from "./shared";
import { getCanvasSpec } from "../knowledge";

// Builder 1 — Canvas Planning
// Sole responsibility: determine the canvas type, orientation, aspect ratio,
// and all spatial boundaries for the layout.

export function buildCanvasPlanning(strategy: CreativeStrategy): CanvasPlanning {
  const platform = strategy.platform.primaryPlatform.value;
  const spec = getCanvasSpec(platform !== "unknown" ? platform : "general");

  const canvasType = lf(
    spec.type as CanvasPlanning["canvasType"]["value"],
    platform !== "unknown" ? "high" : "medium",
    `Canvas type "${spec.type}" derived from platform="${platform}"`
  );

  const canvasOrientation = lf(
    spec.orientation,
    "high",
    `Orientation "${spec.orientation}" is the standard for platform="${platform}"`
  );

  const aspectRatio = (() => {
    const ratioMap: Record<string, CanvasPlanning["aspectRatio"]["value"]> = {
      "1:1": "1:1", "4:5": "4:5", "9:16": "9:16", "16:9": "16:9",
      "1.91:1": "1.91:1", "A4": "A4", "6:1": "6:1",
    };
    const val = ratioMap[spec.aspectRatio] ?? "custom";
    return lf(val, "high", `Aspect ratio "${spec.aspectRatio}" is the native ratio for platform="${platform}"`);
  })();

  const safeZones = lf(spec.safeZone, "high", `Safe zone rule for platform="${platform}" from industry standard`);
  const margins = lf(spec.margins, "high", `Margin specification for platform="${platform}"`);
  const bleedArea = lf(spec.bleed, "high", `Bleed specification for platform="${platform}"`);
  const responsiveZones = lf(spec.responsiveNote, "high", `Responsive cropping note for platform="${platform}"`);

  return { canvasType, canvasOrientation, aspectRatio, safeZones, margins, bleedArea, responsiveZones };
}
