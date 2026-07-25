import type { CreativeContext } from "../creative-context";
import type { CreativeStrategy } from "../creative-brain/types";
import type { CampaignPlan } from "../creative-director/types";
import type { GPTCampaignDirection } from "../creative-director/gpt-types";
import type { VisualLayoutPlan } from "../visual-layout/types";
import type { TypographyPlan } from "../typography/types";
import type { UniversalCampaignBlueprint } from "./types";
import { CampaignBlueprintBuilder } from "./builder";

// Phase 9 — Blueprint Engine.
// Functional entry point for assembling the UniversalCampaignBlueprint.
// assembleBlueprint() is a thin wrapper over CampaignBlueprintBuilder for
// callers who don't need the fluent API (e.g. the route handler).

export interface BlueprintInputs {
  context: CreativeContext;
  strategy: CreativeStrategy;
  campaignPlan: CampaignPlan;
  layoutPlan: VisualLayoutPlan;
  typographyPlan: TypographyPlan;
  /** Phase 5.1 — GPT Creative Director output; stored in the blueprint for downstream use. */
  gptDirection?: GPTCampaignDirection;
  projectId?: string;
}

/** Assembles the UniversalCampaignBlueprint from all AI OS module outputs.
 *  Returns an immutable (shallow frozen) Blueprint.
 *  Pure function — no LLM, no I/O, no side effects. */
export function assembleBlueprint(inputs: BlueprintInputs): Readonly<UniversalCampaignBlueprint> {
  const builder = new CampaignBlueprintBuilder(inputs.context)
    .withStrategy(inputs.strategy)
    .withCampaignPlan(inputs.campaignPlan)
    .withLayoutPlan(inputs.layoutPlan)
    .withTypographyPlan(inputs.typographyPlan)
    .withProjectId(inputs.projectId ?? "");

  return (inputs.gptDirection ? builder.withGPTDirection(inputs.gptDirection) : builder).build();
}
