import { z } from "zod";

// Milestone 16 — the Universal JSON Prompt: the single structured
// intermediate representation every generation request is built into
// before any provider ever sees it. Every nested section uses `.catchall()`
// so new fields (including the eventually-deferred video fields —
// storyboard/camera_motion/character_consistency/etc.) can be added later
// without breaking already-stored JSON or requiring a migration — the
// schema validates the fields it knows about and tolerates the rest.

// `.default({})` on a generic `z.object(shape).catchall(...)` defeats Zod
// 4's overload resolution (its conditional output types can't be resolved
// against an unresolved type parameter T, even though every concrete
// instantiation below is perfectly valid) — the `any` round-trip is a
// narrow, deliberate escape hatch around that inference gap, re-asserting
// the precise, fully-typed output via the explicit return type. Verified at
// both the type level (`universalPromptSchema.parse({})` compiles) and the
// runtime level (omitted sections parse to `{}`, unknown nested fields
// survive via catchall) — see schema.test.ts.
// Exported so other prompt-os schemas (e.g. creative-director.ts's
// CreativeBrief) reuse the exact same catchall-extensible nested-section
// pattern instead of redefining it.
export function section<T extends z.ZodRawShape>(shape: T) {
  const obj = z.object(shape).catchall(z.unknown());
  type Output = z.infer<typeof obj>;
  // Strip null → undefined for every key before the object schema validates.
  // LLMs (confirmed live with gpt-4o-mini) sometimes return null for optional
  // fields instead of omitting them — null and "not provided" are semantically
  // identical for our use case, and individual z.string().optional() fields
  // reject null without this. Applies only to plain-object inputs; arrays and
  // primitives pass through untouched.
  const withNullStrip = z.preprocess((val) => {
    if (val !== null && val !== undefined && typeof val === "object" && !Array.isArray(val)) {
      // Omit null-valued keys entirely so Zod's z.optional() treats them
      // identically to a missing field — more reliable than setting key: undefined,
      // which Zod 4 may handle differently from a truly absent key.
      const stripped: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        if (v !== null) stripped[k] = v;
      }
      return stripped;
    }
    return val;
  }, obj);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withDefault = (withNullStrip as any).default({});
  return withDefault as z.ZodType<Output>;
}

// Real LLMs (confirmed live with gpt-4o-mini, not hypothetical) sometimes
// collapse a single-item "array of strings" field into a bare string — e.g.
// one psychology hook returned as a plain string instead of a 1-element
// array. Previously that threw the entire Universal JSON out via ZodError,
// discarding an otherwise correct, on-topic response over one mis-shaped
// field. Normalize a bare string into a single-element array before
// validating. Used for every LLM-produced array-of-strings field below, and
// exported so creative-director.ts's CreativeBrief schema reuses it too.
//
// Also confirmed live: `branding.brandColors` was returned as a plain
// object (e.g. `{ primary: "#1a3c6e", secondary: "#f97316" }`) instead of
// an array — Object.values() recovers the intended list of color strings
// rather than rejecting the response.
// Confirmed live: LLMs sometimes return null instead of omitting an optional
// array field. Treat null identically to "not provided" (undefined → optional
// downstream), since both mean "the model had nothing to say here".
export function stringArray() {
  return z.preprocess((val) => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === "string") return [val];
    if (typeof val === "object" && !Array.isArray(val)) return Object.values(val);
    return val;
  }, z.array(z.string()).optional());
}

// Same defensive pattern as stringArray() above, generalized to a whole
// section: a real LLM (confirmed live with gpt-4o-mini) sometimes collapses
// an entire single-purpose section object into a bare string holding just
// its one important value — e.g. creative-director.ts's `compositionStrategy`
// (a section with exactly one field, compositionPriority) returned as a
// plain string instead of `{ compositionPriority: "..." }`. Scoped to
// sections with one clear, unambiguous "primary" key — coercing a bare
// string into one of SEVERAL keys in a multi-field section would be a
// guess, not a fix, so this is deliberately not used for every section.
export function sectionOrString<T extends z.ZodRawShape>(shape: T, primaryKey: keyof T & string) {
  return z.preprocess((val) => (typeof val === "string" ? { [primaryKey]: val } : val), section(shape));
}

// The mirror image of stringArray(): some fields are documented as a single
// descriptive string but a real LLM (confirmed live with gpt-4o-mini) sometimes
// returns an array instead — e.g. `featureIcons: ["tooth icon", "shield
// icon"]` instead of one string. Plural-sounding field names (icons, cards,
// panels, visuals) are especially prone to this. Normalizes either shape
// into one joined, readable string rather than rejecting the response.
// Also confirmed live: null is returned instead of omitting the field —
// treated as undefined (no value) rather than a validation failure.
export function stringOrJoinedString() {
  return z.preprocess(
    (val) => {
      if (val === null) return undefined;
      if (Array.isArray(val)) return val.join(", ");
      // Confirmed live: LLM sometimes returns a plain object for a string field
      // (e.g. typographyStrategy: { scale: "1.25", pairing: "sans" }). Join
      // its string values the same way stringArray() handles the same pattern.
      if (typeof val === "object") return Object.values(val as Record<string, unknown>).join(", ");
      return val;
    },
    z.string().optional()
  );
}

export const universalPromptSchema = z.object({
  intent: z.string().default("generate_image"),
  industry: z.string().optional(),
  platform: z.string().optional(),
  creative_type: z.string().optional(),

  style: section({
    mood: z.string().optional(),
    aesthetic: z.string().optional(),
    luxuryLevel: z.string().optional(),
    modernLevel: z.string().optional(),
    minimalism: z.string().optional(),
  }),

  layout: section({
    composition: z.string().optional(),
    // Confirmed live: a real LLM sometimes returns hierarchy as an array
    // (e.g. an ordered list of elements) instead of one descriptive string.
    hierarchy: stringOrJoinedString().optional(),
    whiteSpace: z.string().optional(),
    headlinePosition: z.string().optional(),
    ctaPosition: z.string().optional(),
    logoPosition: z.string().optional(),
  }),

  typography: section({
    treatment: z.string().optional(),
    fontStyle: z.string().optional(),
  }),

  lighting: section({
    direction: z.string().optional(),
    quality: z.string().optional(),
    type: z.string().optional(),
  }),

  camera: section({
    angle: z.string().optional(),
    lens: z.string().optional(),
    depthOfField: z.string().optional(),
    perspective: z.string().optional(),
  }),

  composition: section({
    framing: z.string().optional(),
    focalPoint: z.string().optional(),
    depth: z.string().optional(),
    texture: z.string().optional(),
  }),

  branding: section({
    logoAssetId: z.string().optional(),
    brandColors: stringArray().optional(),
    brandVoice: z.string().optional(),
  }),

  colors: section({
    palette: stringArray().optional(),
    harmony: z.string().optional(),
  }),

  marketing: section({
    goal: z.string().optional(),
    targetAudience: z.string().optional(),
    psychologyHooks: stringArray().optional(),
  }),

  negative_constraints: stringArray().default([]),

  // Phase 2.3 — Universal Prompt Intelligence: `objects` is the literal
  // physical objects/elements expected in the scene (inferred from the idea
  // text, or from the reference's analyzed objects when one was supplied).
  // `referenceAnalysis` echoes the exact Design Intelligence Library
  // analysis (Creative DNA) that was fed into this generation, if any — it
  // already influences style/layout/etc. during the LLM call, this just
  // retains the source data itself so the Prompt Preview panel and future
  // AI modules can see what shaped the result, without re-deriving it.
  // Kept as `unknown` rather than importing assetAnalysisSchema here so the
  // two schemas can evolve independently — it's round-tripped and
  // displayed, never deeply processed downstream.
  objects: stringArray().default([]),
  referenceAnalysis: z.unknown().optional(),
  // Phase 2.4 — AI Creative Director: echoes the structured strategic
  // CreativeBrief (marketing objective, audience, emotional/visual
  // direction, etc.) that was decided BEFORE this Universal JSON was built,
  // when the caller computed one. Same `unknown` decoupling rationale as
  // `referenceAnalysis` above — round-tripped and displayed, never deeply
  // processed downstream of this schema.
  creativeBrief: z.unknown().optional(),

  // A real LLM (confirmed live with gpt-4o-mini, not a hypothetical) reads
  // the system prompt's "quality (keywords array: ...)" instruction and
  // sometimes returns `quality` as a bare array of strings directly,
  // instead of the intended `{ keywords: [...] }` object — a reasonable
  // misreading of that phrasing. Previously this threw the entire Universal
  // JSON out via ZodError (ERR_VALIDATION), discarding an otherwise
  // correct, on-topic response. Normalize a bare array into the expected
  // shape before validating, rather than rejecting it outright.
  quality: z.preprocess(
    (val) => (Array.isArray(val) ? { keywords: val } : val),
    section({
      keywords: stringArray().optional(),
      realism: z.string().optional(),
      resolution: z.string().optional(),
    })
  ),

  output: section({
    aspectRatio: z.string().optional(),
    targetWidth: z.number().int().optional(),
    targetHeight: z.number().int().optional(),
    format: z.string().optional(),
    // Phase 2 — the Creative Brain's kind/preset inference, filled by the
    // model only when the caller didn't already specify a kind (see
    // builder.ts). Free strings here, not the real enum/catalog types —
    // resolveKindAndPreset() in resolve-kind.ts is the single place that
    // validates these against the real CreativeProjectKind enum and the
    // real preset catalogs before anything downstream trusts them, so a
    // hallucinated value can never reach generation.
    recommendedKind: z.string().optional(),
    recommendedPresetKey: z.string().optional(),
  }),
});

export type UniversalPrompt = z.infer<typeof universalPromptSchema>;

