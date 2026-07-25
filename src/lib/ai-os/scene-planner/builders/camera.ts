import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { CameraPlanning } from "../types";
import { sp, unknownSp } from "./shared";

// Builder 7 — Camera Planning
// Where is the camera? How does it see the scene?

export function buildCameraPlanning(bp: UniversalCampaignBlueprint): CameraPlanning {
  const photoDir = bp.campaign.photographyDirection;

  const cameraPosition = (() => {
    const heroPos = bp.layout.blocks.heroBlock.value;
    const viewingAngle = photoDir.perspective.value;
    if (viewingAngle !== "unknown") {
      return sp(`Camera positioned at ${viewingAngle} — ${heroPos !== "unknown" ? `angled toward the hero at "${heroPos}" position in the frame` : "directed toward the hero subject"}`, "high",
        `Camera position from photograph perspective "${viewingAngle}" and hero block "${heroPos}"`);
    }
    return unknownSp("cameraPosition");
  })();

  const cameraHeight = (() => {
    const perspVal = photoDir.perspective.value;
    const heightMap: Record<string, CameraPlanning["cameraHeight"]["value"]> = {
      eye_level:           "eye_level",
      slightly_elevated:   "slightly_elevated",
      overhead:            "overhead_flat_lay",
      low_angle:           "low_angle_heroic",
      dutch_tilt:          "slightly_elevated",
    };
    const val = heightMap[perspVal ?? ""] ?? "eye_level";
    return sp(val, perspVal !== "unknown" ? "high" : "medium", `Camera height "${val}" from photography perspective "${perspVal}"`);
  })();

  const viewingAngle = (() => {
    const framingStyle = photoDir.framingStyle.value;
    const angleMap: Record<string, CameraPlanning["viewingAngle"]["value"]> = {
      rule_of_thirds:          "three_quarter_view",
      centered_symmetry:       "straight_on_direct",
      negative_space_dominant: "three_quarter_view",
      leading_lines:           "three_quarter_view",
      frame_within_frame:      "straight_on_direct",
      edge_tension:            "three_quarter_view",
    };
    const val = angleMap[framingStyle ?? ""] ?? "three_quarter_view";
    return sp(val, framingStyle !== "unknown" ? "high" : "medium", `Viewing angle "${val}" from framing style "${framingStyle}"`);
  })();

  const lensIntent = (() => {
    const lensStyle = photoDir.lensStyle.value;
    const lensMap: Record<string, CameraPlanning["lensIntent"]["value"]> = {
      macro_detail:            "macro_intimate_detail",
      portrait_85mm:           "portrait_natural_compression",
      standard_natural:        "standard_authentic",
      wide_environmental:      "wide_environmental_scale",
      telephoto_compressed:    "telephoto_compressed_elegance",
    };
    const val = lensMap[lensStyle ?? ""] ?? "standard_authentic";
    return sp(val, lensStyle !== "unknown" ? "high" : "medium", `Lens intent "${val}" from photography lens style "${lensStyle}"`);
  })();

  const distance = (() => {
    const shotType = photoDir.shotType.value;
    const shotMap: Record<string, CameraPlanning["distance"]["value"]> = {
      extreme_close_up: "extreme_close_up",
      close_up:         "close_up",
      medium:           "medium_shot",
      wide:             "wide_establishing",
      full_product:     "medium_shot",
      overhead:         "medium_shot",
      split_frame:      "medium_shot",
      aerial:           "wide_establishing",
    };
    const val = shotMap[shotType ?? ""] ?? "medium_shot";
    return sp(val, shotType !== "unknown" ? "high" : "medium", `Camera distance "${val}" from photography shot type "${shotType}"`);
  })();

  const perspective = (() => {
    const depthOfField = photoDir.depth.value;
    const perspMap: Record<string, string> = {
      extreme_shallow_subject_isolation: "Shallow depth of field isolates the subject completely — the background exists only as colour and mood, never as readable content",
      shallow_romantic:                  "Romantic shallow focus — subject is crisp and present, background is a gentle suggestion",
      medium_natural:                    "Natural mid-range depth — both subject and environment read clearly but subject has slight foreground priority",
      deep_environmental:                "Environmental depth — the setting reads as clearly as the subject, environment is part of the story",
      selective_progressive:             "Progressive focus — sharpness decreases gradually from subject to background, creating a natural depth cue",
    };
    const val = perspMap[depthOfField ?? ""] ?? "Subject in sharp focus with environment providing context at reduced clarity";
    return sp(val, depthOfField !== "unknown" ? "high" : "medium", `Perspective from depth-of-field specification "${depthOfField}"`);
  })();

  return { cameraPosition, cameraHeight, viewingAngle, lensIntent, distance, perspective };
}
