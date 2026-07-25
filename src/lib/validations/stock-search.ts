import { z } from "zod";

// Module 11 — Part A: live stock search + materialize-on-drop. Kept
// Prisma-free (mirrors video-editor.ts/asset-library.ts's own convention).

export const STOCK_SEARCH_CATEGORIES = ["STOCK_MEDIA", "ICON"] as const;
export const STOCK_SEARCH_TYPES = ["video", "image", "audio", "icon", "animation"] as const;

// GET /api/editor/stock/search
export const stockSearchQuerySchema = z.object({
  category: z.enum(STOCK_SEARCH_CATEGORIES),
  query: z.string().trim().min(1).max(200),
  type: z.enum(STOCK_SEARCH_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const stockSearchResultSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1).max(300),
  previewUrl: z.string().url(),
  downloadUrl: z.string().url(),
  kind: z.enum(["VIDEO", "IMAGE", "AUDIO", "ICON", "ANIMATION"]),
  attribution: z.string().max(200).optional(),
  // Stock providers expansion (2026-07-18) — without this, z.object()'s
  // default strip behavior would silently drop attributionRequired at
  // this exact API boundary before materializeStockAsset() ever sees it,
  // even though the client sent it — found before it shipped, not live.
  attributionRequired: z.boolean().optional(),
  widthPx: z.number().int().positive().optional(),
  heightPx: z.number().int().positive().optional(),
  durationSeconds: z.number().positive().optional(),
});

// POST /api/editor/stock/materialize — the client sends back the exact
// StockSearchResult it got from the search response (never re-fetched from
// the provider by id here) so a click-to-add/drag-drop doesn't need a
// second network round trip to the vendor before caching it.
export const materializeStockAssetSchema = z.object({
  providerId: z.string().min(1),
  category: z.enum(STOCK_SEARCH_CATEGORIES),
  result: stockSearchResultSchema,
});
