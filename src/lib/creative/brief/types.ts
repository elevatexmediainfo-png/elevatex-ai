// Creative Brief layer (2026-07-27) — the ground-truth business/creative
// facts every video project already has on record (VideoProject.brief,
// Profile, BrandKit), assembled into one canonical, structured JSON shape.
// This layer does NOT interpret, invent, or creatively expand anything —
// that is the Director's job (rule 11: creativity happens entirely in the
// planning/director layers). The Creative Brief is the literal ground truth
// the eventual Creative Compiler cross-checks a Director's plan against, so
// exact facts (contact info, CTA wording) are never silently reworded away.
//
// GENERATED and FILM projects collect genuinely different inputs (see
// videoBriefSchema vs FilmBrief in lib/validations/video.ts / lib/film/types.ts)
// — modeled as a discriminated union on `content.style` rather than one
// flat shape with fields fabricated for whichever style didn't collect them.

export type CreativeBriefStyle = "commercial" | "film";

export interface CreativeBriefBrand {
  businessName: string | null;
  businessVertical: string | null;
  city: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: string | null;
  guidelinesText: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  addressLine: string | null;
  websiteOrSocial: string | null;
}

export interface CreativeBriefCommercialContent {
  style: "commercial";
  objective: string;
  productOrService: string;
  keyMessage: string;
  offerDetails: string | null;
  callToAction: string | null;
  tone: string | null;
}

export interface CreativeBriefFilmContent {
  style: "film";
  idea: string;
  filmStyle: string;
  totalDurationSeconds: number;
  characterCount: number;
}

export type CreativeBriefContent = CreativeBriefCommercialContent | CreativeBriefFilmContent;

export interface CreativeBrief {
  videoProjectId: string;
  contentLanguage: string;
  brand: CreativeBriefBrand;
  content: CreativeBriefContent;
}
