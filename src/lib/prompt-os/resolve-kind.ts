import type { CreativeProjectKind } from "@/generated/prisma/enums";
import { CREATIVE_PROJECT_KINDS, PRESETS_BY_KIND } from "@/lib/validations/creative";

// Phase 2 — the Creative Brain's kind/preset decision, made deterministic
// and testable on purpose: the LLM's free-text `recommendedKind`/
// `recommendedPresetKey` (and, failing that, `creative_type`/`platform`)
// are NEVER trusted directly — every path here is validated against the
// real CreativeProjectKind enum and the real preset catalogs
// (lib/validations/creative.ts), so a hallucinated or malformed value can
// never reach generation. A pure function: no I/O, no LLM call, exhaustively
// unit-testable.

export const DEFAULT_PRESET_BY_KIND: Record<CreativeProjectKind, string> = {
  AI_IMAGE: "square",
  SOCIAL_MEDIA: "instagram_post",
  MARKETING_CREATIVE: "poster",
};

// Keyword buckets checked in this order — MARKETING_CREATIVE and
// SOCIAL_MEDIA are matched first (more specific signals: named platforms,
// named print/marketing formats); AI_IMAGE is the fallback for anything
// that doesn't clearly say "post it on a platform" or "print/marketing
// collateral", since a generic image is the safest default for an
// ambiguous idea.
const SOCIAL_MEDIA_KEYWORDS = [
  "social",
  "instagram",
  "facebook",
  "pinterest",
  "linkedin",
  "twitter",
  "x post",
  "story",
  "carousel",
  "reel",
];
const MARKETING_CREATIVE_KEYWORDS = [
  "poster",
  "flyer",
  "banner",
  "brochure",
  "business card",
  "marketing",
  "print",
  "advertisement",
  "advert",
  " ad ",
  "campaign",
  "promo",
  "promotion",
  "offer",
];

function isCreativeProjectKind(value: string | undefined): value is CreativeProjectKind {
  return !!value && (CREATIVE_PROJECT_KINDS as readonly string[]).includes(value);
}

function keywordMatchKind(text: string | undefined): CreativeProjectKind | undefined {
  if (!text) return undefined;
  const lower = ` ${text.toLowerCase()} `;
  if (SOCIAL_MEDIA_KEYWORDS.some((kw) => lower.includes(kw))) return "SOCIAL_MEDIA";
  if (MARKETING_CREATIVE_KEYWORDS.some((kw) => lower.includes(kw))) return "MARKETING_CREATIVE";
  return undefined;
}

export interface ResolveKindInput {
  recommendedKind?: string;
  recommendedPresetKey?: string;
  creativeType?: string;
  platform?: string;
  /** The user's own raw idea text — checked as a keyword-matching source
   * too, not just the LLM's own creative_type/platform fields, so kind
   * inference stays correct even when the model (e.g. a Mock LLM provider,
   * or a transient bad response) returns a generic/unhelpful creative_type. */
  idea?: string;
}

export interface ResolvedKindAndPreset {
  kind: CreativeProjectKind;
  presetKey: string;
}

export function resolveKindAndPreset(input: ResolveKindInput): ResolvedKindAndPreset {
  const recommended = input.recommendedKind?.trim().toUpperCase();
  const kind: CreativeProjectKind =
    (isCreativeProjectKind(recommended) ? recommended : undefined) ??
    keywordMatchKind(input.idea) ??
    keywordMatchKind(input.creativeType) ??
    keywordMatchKind(input.platform) ??
    "AI_IMAGE";

  const catalog = PRESETS_BY_KIND[kind];
  const recommendedPreset = input.recommendedPresetKey?.trim();
  const validRecommendedPreset =
    recommendedPreset && catalog.some((p) => p.key === recommendedPreset && !p.isCustom) ? recommendedPreset : undefined;

  // Falling back to a platform-label keyword match (e.g. "Instagram Story"
  // mentioned in `platform`) before the generic per-kind default, so a
  // reasonable preset is still picked even when the model didn't fill
  // `recommendedPresetKey` but did say which platform in plain text.
  const platformLower = input.platform?.toLowerCase();
  const labelMatchedPreset = platformLower
    ? catalog.find((p) => !p.isCustom && platformLower.includes(p.label.toLowerCase()))?.key
    : undefined;

  const presetKey = validRecommendedPreset ?? labelMatchedPreset ?? DEFAULT_PRESET_BY_KIND[kind];

  return { kind, presetKey };
}
