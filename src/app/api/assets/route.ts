import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getMusicLibrary, getStockAssetLibrary, listAssets } from "@/lib/assets/service";

const ASSET_KINDS = ["IMAGE", "VIDEO", "VOICE", "STICKER"] as const;
const ASSET_SOURCES = ["AI_GENERATED", "UPLOAD", "STOCK", "BRAND"] as const;

// GET /api/assets?kind=IMAGE|VIDEO|VOICE|STICKER&source=AI_GENERATED|UPLOAD|STOCK|BRAND
// Media Library — always includes the admin-configured music + stock asset
// libraries alongside the user's own rows, since "Music" and "Stock" have no
// per-user Asset rows of their own.
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const kindParam = req.nextUrl.searchParams.get("kind");
  const kind = (ASSET_KINDS as readonly string[]).includes(kindParam ?? "")
    ? (kindParam as (typeof ASSET_KINDS)[number])
    : undefined;
  if (kindParam && !kind) {
    return apiError("ERR_VALIDATION", "kind must be one of IMAGE, VIDEO, VOICE, STICKER.", 400);
  }

  const sourceParam = req.nextUrl.searchParams.get("source");
  const source = (ASSET_SOURCES as readonly string[]).includes(sourceParam ?? "")
    ? (sourceParam as (typeof ASSET_SOURCES)[number])
    : undefined;
  if (sourceParam && !source) {
    return apiError("ERR_VALIDATION", "source must be one of AI_GENERATED, UPLOAD, STOCK, BRAND.", 400);
  }

  const [assets, music, stock] = await Promise.all([
    listAssets(session.user.id, kind, undefined, source),
    getMusicLibrary(),
    getStockAssetLibrary(),
  ]);

  return apiSuccess({ assets, music, stock });
}
