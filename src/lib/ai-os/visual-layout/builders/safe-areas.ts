import type { CreativeStrategy } from "../../creative-brain/types";
import type { SafeAreaPlanning } from "../types";
import { lf } from "./shared";
import { SAFE_AREA_SPECS } from "../knowledge";

// Builder 7 — Safe Area Planning
// Sole responsibility: specify exact safe zones for every platform that
// this creative might appear on, and the active platform's specific rule.

export function buildSafeAreaPlanning(strategy: CreativeStrategy): SafeAreaPlanning {
  const platform = strategy.platform.primaryPlatform.value;

  const instagramSafeArea = lf(
    SAFE_AREA_SPECS.instagram,
    "high",
    "Instagram safe area: standard spec for feed posts — bottom 20% often hidden by caption overlay"
  );

  const facebookSafeArea = lf(
    SAFE_AREA_SPECS.facebook,
    "high",
    "Facebook safe area: keep critical content in centre 80%×80% to survive mobile cropping"
  );

  const youtubeSafeArea = lf(
    SAFE_AREA_SPECS.youtube,
    "high",
    "YouTube safe area: title-safe 10% inset, action-safe 5% inset, player controls at bottom 5%"
  );

  const printSafeArea = lf(
    SAFE_AREA_SPECS.poster,
    "high",
    "Print safe area: 10mm from trim on all sides; 3mm bleed; live copy never in outer 10mm"
  );

  const platformCropSafety = (() => {
    const spec = SAFE_AREA_SPECS[platform ?? ""] ?? SAFE_AREA_SPECS.general;
    return lf(
      spec,
      platform !== "unknown" ? "high" : "medium",
      `Active platform crop safety rule for "${platform}" — this is the critical safe area to observe`
    );
  })();

  return { instagramSafeArea, facebookSafeArea, youtubeSafeArea, printSafeArea, platformCropSafety };
}
