import type { CreativeContext } from "../creative-context";
import type { CreativeStrategy } from "../creative-brain/types";
import type { CampaignPlan } from "../creative-director/types";
import type { GPTCampaignDirection } from "../creative-director/gpt-types";
import type { VisualLayoutPlan } from "../visual-layout/types";
import type { TypographyPlan, CopywritingPlan } from "../typography/types";
import type {
  UniversalCampaignBlueprint,
  UserIntelligenceSection,
  BrandIntelligence,
} from "./types";
import { buildProjectMetadata, buildMemoryReferences } from "./metadata";
import { buildQualityMetadata } from "./validation";
import { planFromStrategy } from "../commercial-assets/adapter";
import { buildCompositionFromBlueprintInputs } from "../commercial-composition/composition-engine";
import { buildCopyFromBlueprintInputs } from "../copy-intelligence/copy-engine";
import { buildTypographyFromBlueprintInputs } from "../typography-intelligence/typography-engine";
import { buildRenderPlanFromComponents }       from "../commercial-renderer/render-plan";
import { resolveCanvasSize }                   from "../commercial-renderer/canvas-engine";
import { buildCommercialReviewFromComponents } from "../commercial-review/review-engine";
import { buildRetryExecutionPlan }             from "../retry-orchestrator/orchestrator";

// Phase 9 — Campaign Blueprint Builder.
// CampaignBlueprintBuilder assembles the UniversalCampaignBlueprint from all
// AI OS module outputs. Fluent API for incremental construction; call build()
// to get the final immutable Blueprint.
//
// STRICT RULES:
//   ✗ Never modifies child objects
//   ✗ Never generates prompts, layouts, or copy
//   ✗ Never calls providers
//   ✓ Only aggregates — acts as a typed container assembler

export class CampaignBlueprintBuilder {
  private context: CreativeContext;
  private strategy?: CreativeStrategy;
  private campaignPlan?: CampaignPlan;
  private layoutPlan?: VisualLayoutPlan;
  private typographyPlan?: TypographyPlan;
  private copywritingPlan?: CopywritingPlan;
  private _gptDirection?: GPTCampaignDirection;
  private projectId?: string;

  constructor(context: CreativeContext) {
    this.context = context;
  }

  withStrategy(strategy: CreativeStrategy): this {
    this.strategy = strategy;
    return this;
  }

  withCampaignPlan(plan: CampaignPlan): this {
    this.campaignPlan = plan;
    return this;
  }

  withLayoutPlan(layout: VisualLayoutPlan): this {
    this.layoutPlan = layout;
    return this;
  }

  withTypographyPlan(typography: TypographyPlan): this {
    this.typographyPlan = typography;
    return this;
  }

  /** Optional — Phase 5.1 GPT Creative Director output. */
  withGPTDirection(dir: GPTCampaignDirection): this {
    this._gptDirection = dir;
    return this;
  }

  /** Optional — Phase 7 CopywritingPlan when built. */
  withCopywritingPlan(copywriting: CopywritingPlan): this {
    this.copywritingPlan = copywriting;
    return this;
  }

  /** Optional — link to an existing project record. */
  withProjectId(projectId: string): this {
    this.projectId = projectId;
    return this;
  }

  /** Assembles and freezes the UniversalCampaignBlueprint.
   *  Throws if any required module output is missing. */
  build(): Readonly<UniversalCampaignBlueprint> {
    if (!this.strategy) throw new Error("CampaignBlueprintBuilder: strategy is required. Call withStrategy() before build().");
    if (!this.campaignPlan) throw new Error("CampaignBlueprintBuilder: campaignPlan is required. Call withCampaignPlan() before build().");
    if (!this.layoutPlan) throw new Error("CampaignBlueprintBuilder: layoutPlan is required. Call withLayoutPlan() before build().");
    if (!this.typographyPlan) throw new Error("CampaignBlueprintBuilder: typographyPlan is required. Call withTypographyPlan() before build().");

    const uu = this.context.userUnderstanding;
    const ai = this.context.assetIntelligence;

    const userIntelligence: UserIntelligenceSection = {
      request: this.context.request,
      understanding: uu,
      rawIdea: this.context.request.rawIdea,
      detectedLanguage: uu.language.value === "hindi" ? "HI" : uu.language.value === "mixed" ? "AUTO" : "EN",
    };

    const brand: BrandIntelligence = {
      context: ai.brandContext,
      kit: ai.brandKit,
      logo: ai.logo,
    };

    const quality = buildQualityMetadata(uu, ai, this.strategy, this.campaignPlan, this.layoutPlan, this.typographyPlan);

    const commercialAssets      = planFromStrategy(this.strategy);
    const commercialComposition = buildCompositionFromBlueprintInputs(
      this.strategy,
      commercialAssets,
      this.layoutPlan,
    );
    const commercialCopy = buildCopyFromBlueprintInputs(
      this.strategy,
      commercialAssets,
      this.context.request.rawIdea,
    );
    const commercialTypography = buildTypographyFromBlueprintInputs(
      this.strategy,
      commercialCopy,
      commercialComposition,
      this.layoutPlan,
    );

    const aspectRatio = this.layoutPlan.canvas.aspectRatio.value ?? "1:1";
    const renderCanvas = resolveCanvasSize(aspectRatio);
    const renderPlan = buildRenderPlanFromComponents(
      commercialComposition,
      commercialCopy,
      commercialTypography,
      this.layoutPlan,
      renderCanvas.width,
      renderCanvas.height,
    );

    const commercialReview = buildCommercialReviewFromComponents(
      commercialComposition,
      commercialCopy,
      commercialTypography,
      renderPlan,
      this.strategy,
      brand,
    );

    const blueprint: UniversalCampaignBlueprint = {
      meta:             buildProjectMetadata(this.projectId),
      userIntelligence,
      assetIntelligence: ai,
      brand,
      strategy:         this.strategy,
      campaign:         this.campaignPlan,
      layout:           this.layoutPlan,
      typography:       this.typographyPlan,
      quality,
      memory:           buildMemoryReferences(this.projectId),
      commercialAssets,
      commercialComposition,
      commercialCopy,
      commercialTypography,
      renderPlan,
      commercialReview,
      retryPlan: buildRetryExecutionPlan(commercialReview),
      ...(this._gptDirection   ? { gptDirection: this._gptDirection }   : {}),
      ...(this.copywritingPlan ? { copywriting: this.copywritingPlan }  : {}),
    };

    // Shallow freeze — the contract is that downstream modules must not mutate.
    return Object.freeze(blueprint);
  }
}
