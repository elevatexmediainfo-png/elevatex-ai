import { z } from "zod";

// Mirrors prisma's BusinessVertical / AppLanguage / ContentLanguage enums —
// kept as a literal Zod enum (not generated from Prisma) so this module has
// no Prisma import and stays usable from client components.
export const BUSINESS_VERTICALS = [
  "RESTAURANT",
  "CAFE_BAKERY",
  "SALON_SPA",
  "DENTAL_DIAGNOSTIC",
  "REAL_ESTATE",
  "RETAIL",
  "GYM_FITNESS",
  "HOSPITAL",
  "COACHING_EDTECH",
  "HOTEL",
  "OTHER",
] as const;

export const APP_LANGUAGES = ["EN", "HI"] as const;
export const CONTENT_LANGUAGES = ["EN", "HI", "HINGLISH"] as const;

// SCR-004 Step 1 — Business Setup: vertical + language are mandatory, city optional.
export const onboardingSchema = z.object({
  businessVertical: z.enum(BUSINESS_VERTICALS),
  businessName: z
    .string()
    .trim()
    .min(1, "Business name is required")
    .max(100, "Business name must be 100 characters or fewer"),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  uiLanguage: z.enum(APP_LANGUAGES),
  contentLanguage: z.enum(CONTENT_LANGUAGES),
  // Milestone 12 — Referral System. Optional; applied at most once per
  // user (lib/referrals/engine.ts's applyReferralCode() enforces this).
  referralCode: z.string().trim().max(20).optional().or(z.literal("")),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
