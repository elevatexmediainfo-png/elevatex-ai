import { generateScript } from "@/lib/generation/llm";
import type { CreativeProjectKind } from "@/generated/prisma/enums";
import { universalPromptSchema, type UniversalPrompt } from "./schema";
import type { AssetAnalysisResult } from "@/lib/design-intelligence/schema";
import type { CreativeBrief } from "./creative-director";

// Creative Director 2.0 (Advertising Campaign Intelligence) confirmed live
// that the final adapter-bound prompt now routinely reaches the previous
// 4000-char cap and gets cut off mid-sentence — including losing the
// negative_constraints clause entirely, since the OpenAI adapter appends it
// last. Raised with real headroom rather than re-measured exactly, since a
// richer Creative Brief (Steps 2/5/8) will keep growing this number further;
// still far inside gpt-image-1's real prompt-length tolerance.
const MAX_OUTPUT_LENGTH = 6000;

// Models occasionally ignore "no quotes/no labels" instructions — strip the
// common ways that shows up (wrapping quotes, a "Prompt:"-style label, ```
// code fences) rather than surfacing that noise to the user, and collapse
// to a single line since an image prompt is one descriptive block, not
// multiple paragraphs. Kept from the pre-Milestone-16 prompt-enhancement.ts
// — still needed to sanitize a provider adapter's output text before it's
// shown in the Prompt Editor.
export function cleanEnhancedPrompt(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "");
  text = text.replace(/^(enhanced( image)? prompt|prompt)\s*:\s*/i, "");
  text = text.trim();
  if (
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))
  ) {
    text = text.slice(1, -1).trim();
  }
  text = text.replace(/\s*\n+\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  if (text.length > MAX_OUTPUT_LENGTH) {
    text = text.slice(0, MAX_OUTPUT_LENGTH).trim();
  }
  return text;
}

// Exported so other prompt-os LLM-calling modules (e.g. creative-director.ts)
// reuse the exact same lenient JSON-fence-stripping parse instead of
// redefining it.
export function parseJsonLoose(raw: string): unknown {
  let text = raw.trim();
  text = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  return JSON.parse(text);
}

const KIND_CONTEXT: Record<CreativeProjectKind, string> = {
  AI_IMAGE: "a general-purpose AI-generated image",
  SOCIAL_MEDIA: "a social media platform graphic",
  MARKETING_CREATIVE: "a piece of marketing/print collateral",
};

const SYSTEM_PROMPT =
  "You are a professional AI image-prompt engineer producing agency-level marketing creative briefs, the " +
  "caliber of a senior creative director briefing a photographer for Apple, Nike, Airbnb, or a luxury real " +
  "estate campaign. You will be given a user's one-sentence idea (and sometimes a reference image's analyzed " +
  "visual style, and the user's brand colors/fonts). Return ONLY a single JSON object (no markdown, no prose, " +
  "no code fences) describing a complete, structured generation brief with these top-level keys: intent, " +
  "industry, platform, creative_type, style (mood/aesthetic/luxuryLevel/modernLevel/minimalism), layout " +
  "(composition/hierarchy/whiteSpace/headlinePosition/ctaPosition/logoPosition), typography " +
  "(treatment/fontStyle), lighting (direction/quality/type), camera (angle/lens/depthOfField/perspective), " +
  "composition (framing/focalPoint/depth/texture), branding (brandColors/brandVoice), colors " +
  "(palette/harmony), marketing (goal/targetAudience/psychologyHooks), negative_constraints (array of strings " +
  "to avoid: cartoon look, plastic faces, low detail, distorted text, bad anatomy, cheap layout), objects " +
  "(array of short strings naming the literal physical objects/elements expected in the scene), quality (an " +
  "object shaped { keywords: [...] } — NOT a bare array — containing only the keywords relevant to the subject " +
  "from: photorealistic, ultra detailed, professional photography, cinematic lighting, 8k, natural skin " +
  "texture, realistic reflections, accurate shadows), and output " +
  "(aspectRatio/format). Infer every field you reasonably can from the one-sentence idea — the user should " +
  "never need to type any of this themselves. When a reference image's visual style is provided, fill " +
  "style/layout/typography/lighting/camera/composition/colors/marketing to match that exact visual language " +
  "(not a generic restyle) while executing the user's own idea as the subject.";

// Phase 2.4 — AI Creative Director: appended only when a Creative Brief was
// already decided upstream (enhance-prompt's route calls buildCreativeBrief()
// before this function). Keeps the no-brief call sites (none currently
// exist, but this guards future ones) byte-identical to before.
const CREATIVE_BRIEF_SUFFIX =
  " A Creative Director has already decided the creative strategy for this idea — treat the supplied Creative " +
  "Brief as binding direction, not a suggestion. Your job is only to translate its marketingObjective, " +
  "targetAudience, visualStrategy, messagingStrategy, colorPsychology, layoutDirection, compositionStrategy, " +
  "typographyStrategy, callToAction, attentionHook, and platformOptimization into the structured visual/technical " +
  "fields above — never re-decide the strategy yourself, and never contradict the brief.";

// Phase 2 — appended to SYSTEM_PROMPT only when the caller didn't already
// know which of the 3 creative kinds this is (the Universal Creative
// Engine's zero-config entry point). Keeping this as a separate suffix
// (not folded into the base prompt) means the explicit-kind call sites
// (the existing 3 /create routes) get byte-identical system-prompt
// behavior to before this change.
const AUTO_KIND_SUFFIX =
  " The user has not told you which kind of creative this is or which platform/format it's for — decide both " +
  'yourself from the idea and include them in `output`: `output.recommendedKind` must be exactly one of ' +
  '"AI_IMAGE" (a general-purpose standalone image — the safe default when nothing else fits), "SOCIAL_MEDIA" ' +
  "(the idea names or clearly implies a social platform — Instagram, Facebook, Pinterest, LinkedIn, X, a " +
  '"post"/"story"/"reel"), or "MARKETING_CREATIVE" (the idea is for print/marketing collateral — a poster, ' +
  "flyer, banner, brochure, business card, or an explicit \"advertisement\"/\"campaign\"/\"promotion\"). " +
  "`output.recommendedPresetKey` must be a realistic preset key for that kind (e.g. \"instagram_post\", " +
  '"poster", "square") reflecting the best-fitting format for the idea.';

// Shared base context every prompt-os LLM call needs — idea, kind, preset,
// reference analysis, brand kit. Exported so creative-director.ts builds its
// own user message from the exact same context lines instead of duplicating
// this logic (it adds no fields builder.ts doesn't already have).
export interface PromptOsContextInput {
  idea: string;
  /** Omit to let the Creative Brain infer the kind itself (see AUTO_KIND_SUFFIX) — the Universal Creative Engine's zero-config entry point. */
  kind?: CreativeProjectKind;
  presetLabel?: string;
  referenceAnalysis?: AssetAnalysisResult;
  brandKit?: { primaryColor?: string | null; secondaryColor?: string | null; fontFamily?: string | null };
}

export interface BuildUniversalPromptInput extends PromptOsContextInput {
  /** Phase 2.4 — the Creative Director's strategic decisions, computed upstream and supplied as binding direction. */
  creativeBrief?: CreativeBrief;
  output?: { aspectRatio?: string; targetWidth?: number; targetHeight?: number };
}

export function buildContextLines(input: PromptOsContextInput): string[] {
  const lines = [`Idea: ${input.idea}`];
  if (input.kind) lines.push(`Creative kind: ${KIND_CONTEXT[input.kind]}`);
  if (input.presetLabel) lines.push(`Platform: ${input.presetLabel}`);
  if (input.referenceAnalysis) {
    lines.push(`Reference image visual-style analysis (JSON): ${JSON.stringify(input.referenceAnalysis)}`);
  }
  if (input.brandKit && (input.brandKit.primaryColor || input.brandKit.secondaryColor || input.brandKit.fontFamily)) {
    lines.push(`Brand kit: ${JSON.stringify(input.brandKit)}`);
  }
  return lines;
}

function buildUserMessage(input: BuildUniversalPromptInput): string {
  const lines = buildContextLines(input);
  if (input.creativeBrief) {
    lines.push(`Creative Brief (JSON) — binding creative strategy: ${JSON.stringify(input.creativeBrief)}`);
  }
  lines.push("", "Build the Universal JSON Prompt for this idea.");
  return lines.join("\n");
}

// Milestone 16 — replaces lib/creative/prompt-enhancement.ts's
// enhanceCreativePrompt() entirely (one enhancement path, not two parallel
// ones). Produces the structured Universal JSON Prompt that the rest of
// the pipeline (provider adapters, persistence) treats as the single
// source of truth — the literal "never build prompts as plain text first"
// requirement.
export async function buildUniversalPromptFromIdea(
  input: BuildUniversalPromptInput,
  userId: string
): Promise<UniversalPrompt> {
  let systemPrompt = input.kind ? SYSTEM_PROMPT : SYSTEM_PROMPT + AUTO_KIND_SUFFIX;
  if (input.creativeBrief) systemPrompt += CREATIVE_BRIEF_SUFFIX;

  const result = await generateScript(
    {
      prompt: buildUserMessage(input),
      contentLanguage: "EN",
      systemPrompt,
      responseFormat: "json",
    },
    { userId },
    "prompt_engineering"
  );

  let parsed: unknown;
  try {
    parsed = parseJsonLoose(result.text);
  } catch {
    throw new Error("Prompt engineering did not return valid JSON.");
  }

  const prompt = universalPromptSchema.parse(parsed);

  return {
    ...prompt,
    creative_type: prompt.creative_type ?? input.kind,
    platform: prompt.platform ?? input.presetLabel,
    // Phase 2.3 — prefer the model's own inference; fall back to the
    // reference's analyzed objects when the model didn't name any.
    objects: prompt.objects.length ? prompt.objects : input.referenceAnalysis?.objects ?? [],
    // Echo the exact Creative DNA used for this generation (if any) so the
    // Universal JSON is self-describing about what reference data shaped it.
    referenceAnalysis: input.referenceAnalysis,
    // Phase 2.4 — echo the Creative Director's strategic brief (if any) so
    // the Universal JSON is self-describing about what strategy shaped it.
    creativeBrief: input.creativeBrief,
    output: {
      ...prompt.output,
      aspectRatio: input.output?.aspectRatio ?? prompt.output.aspectRatio,
      targetWidth: input.output?.targetWidth ?? prompt.output.targetWidth,
      targetHeight: input.output?.targetHeight ?? prompt.output.targetHeight,
    },
  };
}
