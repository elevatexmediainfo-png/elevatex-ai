import { z } from "zod";

import { INDUSTRY_POSTER_META } from "@/lib/creative/poster-prompt";
import type { BusinessVertical } from "@/generated/prisma/enums";

// Admin Reference Library, Part A. INDUSTRY_VALUES is derived from
// INDUSTRY_POSTER_META's keys rather than a hand-typed literal — this
// codebase already has two independent hand-duplicated BusinessVertical
// lists (onboarding.ts's 11-value BUSINESS_VERTICALS, missing FINANCE; and
// admin/templates/route.ts's own 12-value inline list); deriving from the
// one object this feature already reuses for labels avoids adding a third.
const INDUSTRY_VALUES = Object.keys(INDUSTRY_POSTER_META) as [BusinessVertical, ...BusinessVertical[]];

export const referenceUploadMetaSchema = z.object({
  industry: z.enum(INDUSTRY_VALUES),
  label: z.string().trim().max(150).optional(),
});
export type ReferenceUploadMetaInput = z.infer<typeof referenceUploadMetaSchema>;

export const updateReferenceSchema = z.object({
  label: z.string().trim().max(150).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateReferenceInput = z.infer<typeof updateReferenceSchema>;

export const upsertGuidanceNoteSchema = z.object({
  industry: z.enum(INDUSTRY_VALUES),
  notes: z.string().trim().max(4000),
});
export type UpsertGuidanceNoteInput = z.infer<typeof upsertGuidanceNoteSchema>;
