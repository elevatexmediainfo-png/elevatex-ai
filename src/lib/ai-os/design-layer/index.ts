// Phase 8 — Design Intelligence Layer.
//
// Public API for the four specialized AI Directors + Prompt Compiler.
// Feature-flagged: only runs when ENABLE_DESIGN_INTELLIGENCE_LAYER=true.
//
// Usage:
//   import { runDesignIntelligenceLayer } from "@/lib/ai-os/design-layer";
//   const result = await runDesignIntelligenceLayer({ gptDirection, strategy, aspectRatio });
//
// The compiledPrompt in the result is a drop-in replacement for buildNarrativePrompt()
// when this layer is enabled.

export type {
  DesignIntelligenceInput,
  DesignIntelligenceOutput,
  DesignDirectorOutput,
  PhotographyDirectorOutput,
  TypographyDirectorOutput,
  LayoutDirectorOutput,
  IndustryCategory,
} from "./types";

import type { DesignIntelligenceInput, DesignIntelligenceOutput } from "./types";
import { buildDesignDirectorOutput }    from "./design-director";
import { buildPhotographyDirectorOutput } from "./photography-director";
import { buildTypographyDirectorOutput }  from "./typography-director";
import { buildLayoutDirectorOutput }      from "./layout-director";
import { compileDesignIntelligencePrompt } from "./prompt-compiler";

export const DESIGN_INTELLIGENCE_LAYER_ENABLED =
  process.env.ENABLE_DESIGN_INTELLIGENCE_LAYER === "true";

/**
 * Orchestrates all four AI Directors and the Prompt Compiler in sequence.
 * Pure deterministic — no LLM calls, no I/O, no side effects.
 * Runs in < 5ms on any hardware.
 */
export function runDesignIntelligenceLayer(
  input: DesignIntelligenceInput,
): DesignIntelligenceOutput {
  const { gptDirection, strategy, aspectRatio = "9:16" } = input;

  const designPlan      = buildDesignDirectorOutput(gptDirection, strategy);
  const photographyPlan = buildPhotographyDirectorOutput(gptDirection, strategy, aspectRatio);
  const typographyPlan  = buildTypographyDirectorOutput(designPlan, strategy);
  const layoutPlan      = buildLayoutDirectorOutput(designPlan, typographyPlan, aspectRatio);

  const compiledPrompt  = compileDesignIntelligencePrompt({
    gptDirection,
    design:      designPlan,
    photography: photographyPlan,
    typography:  typographyPlan,
    layout:      layoutPlan,
    industry:    strategy.business.industry.value,
  });

  return {
    designPlan,
    photographyPlan,
    typographyPlan,
    layoutPlan,
    compiledPrompt,
  };
}
