import { z } from "zod";

// Milestone 11 Part 9 — Brand Kit. Per-user (no Workspace/Team model exists
// in this codebase), one row per User. Asset references are plain strings,
// not validated against a real Asset row here — same "resolved defensively
// at read time" choice already used for VideoProject.thumbnailSceneId.
export const updateBrandKitSchema = z.object({
  logoAssetId: z.string().trim().min(1).max(60).optional().or(z.literal("")),
  introAnimationId: z.string().trim().min(1).max(60).optional().or(z.literal("")),
  musicAssetId: z.string().trim().min(1).max(60).optional().or(z.literal("")),
  outroAssetId: z.string().trim().min(1).max(60).optional().or(z.literal("")),
  watermarkAssetId: z.string().trim().min(1).max(60).optional().or(z.literal("")),
  watermarkPosition: z.enum(["top_left", "top_right", "bottom_left", "bottom_right"]).optional(),
  primaryColor: z.string().trim().max(20).optional().or(z.literal("")),
  secondaryColor: z.string().trim().max(20).optional().or(z.literal("")),
  fontFamily: z.string().trim().max(60).optional().or(z.literal("")),
  contactPhone: z.string().trim().max(30).optional().or(z.literal("")),
  contactWhatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  addressLine: z.string().trim().max(200).optional().or(z.literal("")),
  websiteOrSocial: z.string().trim().max(150).optional().or(z.literal("")),
});

export type UpdateBrandKitInput = z.infer<typeof updateBrandKitSchema>;

// Milestone 14 — Brand Assets generation, folded into this same Brand Kit
// page rather than a separate project model (decision: writes land directly
// on the BrandKit row's logoAssetId/primaryColor/secondaryColor/
// guidelinesText fields, there is no per-generation project to track).
export const BRAND_LOGO_STYLES = ["MINIMAL", "MODERN", "PLAYFUL", "LUXURY", "BOLD"] as const;
export const generateBrandLogoSchema = z.object({
  businessName: z.string().trim().min(1).max(120),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  style: z.enum(BRAND_LOGO_STYLES).optional(),
});
export type GenerateBrandLogoInput = z.infer<typeof generateBrandLogoSchema>;

export const BRAND_PALETTE_MOODS = ["VIBRANT", "MINIMAL", "LUXURY", "EARTHY", "CORPORATE"] as const;
export const generateBrandPaletteSchema = z.object({
  businessName: z.string().trim().min(1).max(120),
  mood: z.enum(BRAND_PALETTE_MOODS).optional(),
});
export type GenerateBrandPaletteInput = z.infer<typeof generateBrandPaletteSchema>;

export const generateBrandGuidelinesSchema = z.object({
  businessName: z.string().trim().min(1).max(120),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  toneDescription: z.string().trim().max(400).optional().or(z.literal("")),
});
export type GenerateBrandGuidelinesInput = z.infer<typeof generateBrandGuidelinesSchema>;
