import { z } from "zod";

// Milestone 26 — Admin Asset Library. Kept Prisma-free (mirrors
// video-editor.ts's own convention) even though this is an admin-only
// surface, for the same reason: safely importable from a client component
// without pulling in generated Prisma types.

export const LIBRARY_ASSET_CATEGORIES = [
  "VIDEO",
  "IMAGE",
  "AUDIO",
  "SFX",
  "MUSIC",
  "ANIMATION",
  "STATIC_ICON",
  "ANIMATED_ICON",
  // Module 11 — Creative Studio Sidebar's library-only tabs. All six map to
  // kind: IMAGE (pre-rendered assets, same as STATIC_ICON) — see this
  // file's LIBRARY_CATEGORY_TO_KIND comment and the schema's own comment
  // on LibraryAssetCategory for why these aren't a new clip/content type.
  "TEMPLATE",
  "TRANSITION",
  "EFFECT",
  "SHAPE",
  "STICKER",
  "LOGO",
] as const;
export type LibraryAssetCategory = (typeof LIBRARY_ASSET_CATEGORIES)[number];

// Every category maps to exactly one EditorAssetKind — the coarse kind
// that drives clip/track compatibility elsewhere in the editor. sfx/music
// are both AUDIO; static-icon is IMAGE (plain SVG/PNG); animated-icon is
// ANIMATION (Lottie JSON), same as the plain "animation" category.
// Module 11's 6 new categories are all pre-rendered IMAGE assets (same
// reasoning as static-icon) — a future admin wanting an animated sticker/
// logo already has the animated-icon pattern to mirror, not a reason to
// widen this mapping speculatively now.
export const LIBRARY_CATEGORY_TO_KIND: Record<LibraryAssetCategory, "VIDEO" | "AUDIO" | "IMAGE" | "ANIMATION"> = {
  VIDEO: "VIDEO",
  IMAGE: "IMAGE",
  AUDIO: "AUDIO",
  SFX: "AUDIO",
  MUSIC: "AUDIO",
  ANIMATION: "ANIMATION",
  STATIC_ICON: "IMAGE",
  ANIMATED_ICON: "ANIMATION",
  TEMPLATE: "IMAGE",
  TRANSITION: "IMAGE",
  EFFECT: "IMAGE",
  SHAPE: "IMAGE",
  STICKER: "IMAGE",
  LOGO: "IMAGE",
};

// Deliberately separate from lib/validations/editor.ts's ALLOWED_MIME_BY_KIND
// (the regular user-upload allowlist) — adding raw image/svg+xml or
// application/json to that shared map would incorrectly widen what a
// normal user IMAGE upload accepts. STATIC_ICON/ANIMATION/ANIMATED_ICON
// entries below can't be verified by magic-byte sniffing (file-type can't
// sniff SVG or JSON, both text formats) — see lib/video-editor/asset-library.ts's
// content-based validators for those two.
export const LIBRARY_ALLOWED_MIME_BY_CATEGORY: Record<LibraryAssetCategory, string[]> = {
  VIDEO: ["video/mp4", "video/quicktime", "video/webm"],
  IMAGE: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  AUDIO: ["audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg"],
  SFX: ["audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg"],
  MUSIC: ["audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg"],
  ANIMATION: ["application/json"],
  STATIC_ICON: ["image/svg+xml", "image/png"],
  ANIMATED_ICON: ["application/json"],
  TEMPLATE: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  TRANSITION: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  EFFECT: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  SHAPE: ["image/svg+xml", "image/png"],
  STICKER: ["image/svg+xml", "image/png", "image/webp", "image/gif"],
  LOGO: ["image/svg+xml", "image/png", "image/webp"],
};

// POST /api/admin/asset-library/upload — multipart form. `category`/
// `categories` describe how each uploaded file/zip-entry is tagged:
// `category` is the batch default, `categories` (JSON-encoded in the form)
// optionally overrides it per filename.
export const uploadLibraryAssetBatchSchema = z.object({
  category: z.enum(LIBRARY_ASSET_CATEGORIES),
  categories: z.record(z.string(), z.enum(LIBRARY_ASSET_CATEGORIES)).optional(),
});

// GET /api/admin/asset-library
export const listLibraryAssetsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.enum(LIBRARY_ASSET_CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});
