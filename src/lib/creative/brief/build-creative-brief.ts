import type { VideoBriefInput } from "@/lib/validations/video";
import type { FilmBrief } from "@/lib/film/types";
import type { CreativeBrief, CreativeBriefBrand } from "./types";

// Pure transforms only — no Prisma import here, so these are testable with
// plain fixture objects and no DB mocking (rule 8: independently testable
// in isolation). get-creative-brief.ts is the thin DB-fetching wrapper that
// calls these; mirrors this codebase's existing Director pattern (route
// handlers fetch, planFilm()/planCommercialFromScript() take explicit data).

export interface CreativeBriefProfileInput {
  businessName: string | null;
  businessVertical: string | null;
  city: string | null;
}

export interface CreativeBriefBrandKitInput {
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: string | null;
  guidelinesText: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  addressLine: string | null;
  websiteOrSocial: string | null;
}

function buildBrand(
  profile: CreativeBriefProfileInput | null,
  brandKit: CreativeBriefBrandKitInput | null
): CreativeBriefBrand {
  return {
    businessName: profile?.businessName ?? null,
    businessVertical: profile?.businessVertical ?? null,
    city: profile?.city ?? null,
    primaryColor: brandKit?.primaryColor ?? null,
    secondaryColor: brandKit?.secondaryColor ?? null,
    fontFamily: brandKit?.fontFamily ?? null,
    guidelinesText: brandKit?.guidelinesText ?? null,
    contactPhone: brandKit?.contactPhone ?? null,
    contactWhatsapp: brandKit?.contactWhatsapp ?? null,
    addressLine: brandKit?.addressLine ?? null,
    websiteOrSocial: brandKit?.websiteOrSocial ?? null,
  };
}

export interface BuildCommercialCreativeBriefInput {
  videoProjectId: string;
  contentLanguage: string;
  objective: string;
  brief: VideoBriefInput;
  profile: CreativeBriefProfileInput | null;
  brandKit: CreativeBriefBrandKitInput | null;
}

export function buildCommercialCreativeBrief(input: BuildCommercialCreativeBriefInput): CreativeBrief {
  return {
    videoProjectId: input.videoProjectId,
    contentLanguage: input.contentLanguage,
    brand: buildBrand(input.profile, input.brandKit),
    content: {
      style: "commercial",
      objective: input.objective,
      productOrService: input.brief.productOrService,
      keyMessage: input.brief.keyMessage,
      offerDetails: input.brief.offerDetails?.trim() || null,
      callToAction: input.brief.callToAction?.trim() || null,
      tone: input.brief.tone ?? null,
    },
  };
}

export interface BuildFilmCreativeBriefInput {
  videoProjectId: string;
  contentLanguage: string;
  filmBrief: FilmBrief;
  profile: CreativeBriefProfileInput | null;
  brandKit: CreativeBriefBrandKitInput | null;
}

export function buildFilmCreativeBrief(input: BuildFilmCreativeBriefInput): CreativeBrief {
  return {
    videoProjectId: input.videoProjectId,
    contentLanguage: input.contentLanguage,
    brand: buildBrand(input.profile, input.brandKit),
    content: {
      style: "film",
      idea: input.filmBrief.idea,
      filmStyle: input.filmBrief.style,
      totalDurationSeconds: input.filmBrief.totalDurationSeconds,
      characterCount: input.filmBrief.characterCount,
    },
  };
}
