import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { getConfig } from "@/lib/admin/config";
import { apiSuccess, apiError } from "@/lib/api-response";

// GET /api/editor/caption-presets — Subtitle track's "Caption template"
// picker (Module 7, Part D). Reads the EXISTING admin-configurable
// CAPTION_STYLE_PRESETS registry key (lib/admin/config.ts) rather than a
// new parallel list — that key already anticipated exactly this (a
// karaoke_yellow / minimal_white style-preset shape with highlightColor),
// it just had no consumer until now. Data-driven: adding a new preset in
// the admin panel needs zero code changes here.
export async function GET(_req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const presets = await getConfig("CAPTION_STYLE_PRESETS");
  return apiSuccess({ presets });
}
