import { z } from "zod";

// Milestone 11 — Talking Head pipeline validation schemas, kept in their
// own module rather than growing video.ts/editor.ts further (this folder's
// one-file-per-domain convention).

// POST /api/videos/[id]/music — AI Marketing Assistant's "Improve Music".
// null clears the project's background music entirely.
export const swapMusicSchema = z.object({
  assetId: z.string().trim().min(1).max(60).nullable(),
});
