import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createExportSchema } from "@/lib/validations/editor";
import { createExport, ExportUnavailableError, InvalidStateError, listExports } from "@/lib/export/service";
import { InsufficientCreditsError } from "@/lib/credits/engine";
import { checkRateLimit } from "@/lib/security/rate-limit";

// POST /api/videos/[id]/exports — Export System: 720p/1080p/4K, watermark
// on/off, codec choice. Creates an Export row + a RenderJob tagged
// payload.kind: "export" — picked up by the SAME render queue worker as
// scene renders/merges (Background Rendering), processed by
// lib/render/pipeline.ts's processExportJob().
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const rateLimit = await checkRateLimit("export_create", session.user.id);
    if (!rateLimit.allowed) {
      return apiError("ERR_RATE_LIMIT", "Too many exports. Please try again later.", 429, {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const body = await req.json().catch(() => ({}));
    const data = createExportSchema.parse(body);

    const exportRow = await createExport(id, session.user.id, data);
    return apiSuccess({ export: exportRow }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the export options and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    if (err instanceof ExportUnavailableError) {
      return apiError("ERR_UNAVAILABLE", err.message, 503);
    }
    if (err instanceof InsufficientCreditsError) {
      return apiError(
        "ERR_INSUFFICIENT_CREDITS",
        `You need ${err.required} credit(s) but only have ${err.available}. Buy more credits to export this video.`,
        402
      );
    }
    console.error("POST /api/videos/[id]/exports failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

// GET /api/videos/[id]/exports — Export System's history list.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const exports = await listExports(id, session.user.id);
    return apiSuccess({ exports });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("GET /api/videos/[id]/exports failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
