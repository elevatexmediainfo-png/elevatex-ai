// Phase 10.6F — Translator Bypass Experiment.
// Output of the minimal Prompt Builder — the non-editorial alternative to a
// Provider Translator used only when ENABLE_PROVIDER_TRANSLATOR is off.

export interface MinimalPromptResult {
  /** The formatted prompt string — existing field values joined, nothing added. */
  finalPrompt: string;
  /** "section.field" paths whose value was included, in the order they appear. */
  fieldsIncluded: string[];
  /** "section.field" paths that were "unknown"/"not_applicable"/empty and skipped. */
  fieldsSkipped: string[];
  /** Whether spec.gptNarrative.narrativePrompt was used verbatim instead of the
   *  generic field walk (only possible when GPT Creative Director produced one). */
  usedGptNarrative: boolean;
  estimatedPromptLength: number;
  estimatedTokenCount: number;
}
