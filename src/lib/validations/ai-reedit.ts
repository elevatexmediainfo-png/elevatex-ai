import { z } from "zod";

// Phase 12 Module 9 — Prompt-based re-edit. Interprets ONE free-text
// instruction about ONE currently-selected clip into ONE of a small,
// fixed set of real operations — never arbitrary code, never a forced
// guess. Deliberately scoped to a SINGLE clip (see the module's own
// DO-NOT-build list): a plan with no clip selected, or 2+ selected,
// never reaches this schema at all — the panel short-circuits with a
// "select a single clip" message before ever calling the reasoning
// provider, since none of the 6 actions below make sense without
// exactly one target.

export const AI_REEDIT_REMOVE_EFFECTS = ["zoom", "transition_before", "transition_after"] as const;
export const AI_REEDIT_TRANSFORM_PROPERTIES = ["position", "scale", "rotation", "opacity"] as const;

const removeEffectSchema = z.object({
  action: z.literal("remove_effect"),
  effect: z.enum(AI_REEDIT_REMOVE_EFFECTS),
});

// searchQuery mirrors aiBrollSchema's own stock-query convention (Module
// 5) exactly — short, literal, keyword-style, not a full sentence — since
// it's resolved through the SAME searchStockMedia/pickBestStockResult/
// materializeStockAsset path, not a new one.
const changeAssetSchema = z.object({
  action: z.literal("change_asset"),
  searchQuery: z.string().min(1).max(120),
});

// `value` is an ABSOLUTE target (never a relative delta — "make it 20%
// bigger" must be resolved to a real target percentage by the model
// using the clip's CURRENT value, given in the prompt) for exactly ONE
// transform property, applied as a STATIC value (any existing keyframes
// on that property are cleared — this operation is for one-off
// adjustments, not building an animation; "keep the zoom but change how
// far it goes" isn't a supported case here). Position needs {x,y};
// scale/rotation/opacity need a plain number — validated by the
// `.refine()` below rather than a nested discriminated union, since Zod
// discriminated unions need every arm to share one flat literal key.
const adjustTransformSchema = z.object({
  action: z.literal("adjust_transform"),
  property: z.enum(AI_REEDIT_TRANSFORM_PROPERTIES),
  value: z.union([z.number(), z.object({ x: z.number(), y: z.number() })]),
});

// Only the caption-relevant subset of ClipContent — every field optional,
// the model sets only what the instruction actually calls for (e.g.
// "make the captions bigger" -> fontSize only). Merged into the clip's
// EXISTING content client-side, never a full replacement.
const changeCaptionStyleSchema = z.object({
  action: z.literal("change_caption_style"),
  reveal: z
    .object({
      mode: z.enum(["NONE", "WORD", "CHARACTER", "KARAOKE"]).optional(),
      unitDurationMs: z.number().int().min(20).max(5000).optional(),
      style: z.enum(["FADE", "POP", "COLOR_SWEEP"]).optional(),
      highlightColor: z.string().max(20).optional(),
    })
    .optional(),
  color: z.string().max(20).optional(),
  fontSize: z.number().int().min(8).max(200).optional(),
});

const deleteClipSchema = z.object({ action: z.literal("delete_clip") });

// The REQUIRED escape hatch — never silently forced into the nearest
// supported action. `message` is shown to the user verbatim, so it must
// read as a real, short, user-facing sentence (never JSON/internal
// jargon) explaining what's wrong or what to clarify.
const cannotDoSchema = z.object({
  action: z.literal("cannot_do"),
  message: z.string().min(1).max(300),
});

export const aiReeditResponseSchema = z
  .discriminatedUnion("action", [removeEffectSchema, changeAssetSchema, adjustTransformSchema, changeCaptionStyleSchema, deleteClipSchema, cannotDoSchema])
  .refine((v) => v.action !== "adjust_transform" || (v.property === "position" ? typeof v.value === "object" : typeof v.value === "number"), {
    message: "adjust_transform: value must be {x,y} for property \"position\", or a plain number for scale/rotation/opacity.",
  });

export type AIReeditResponse = z.infer<typeof aiReeditResponseSchema>;
