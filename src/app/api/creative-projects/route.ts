import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { newTraceId, traceStep } from "@/lib/observability/production-trace";
import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import type { CreativeProjectKind } from "@/generated/prisma/enums";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createCreativeProjectSchema, CREATIVE_PROJECT_KINDS } from "@/lib/validations/creative";
import { generateCreativeImage, CreativeToolDisabledError } from "@/lib/creative/engine";
import { InsufficientCreditsError } from "@/lib/credits/engine";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getStorageProvider } from "@/lib/providers/storage";

// GET /api/creative-projects?kind= — list the signed-in user's AI Image /
// Social Media / Marketing Creative projects, newest first. One generic
// model (CreativeProject) backs all three, discriminated by `kind` — same
// list endpoint serves /images and /marketing-creatives.
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const kindParam = req.nextUrl.searchParams.get("kind");
  const kinds = kindParam
    ? (kindParam.split(",").filter((k) => CREATIVE_PROJECT_KINDS.includes(k as CreativeProjectKind)) as CreativeProjectKind[])
    : undefined;

  const projects = await prisma.creativeProject.findMany({
    where: { userId: session.user.id, ...(kinds && kinds.length > 0 ? { kind: { in: kinds } } : {}) },
    orderBy: { createdAt: "desc" },
  });

  const storage = await getStorageProvider();
  const assetIds = projects.map((p) => p.resultAssetId).filter((id): id is string => Boolean(id));
  const assets = assetIds.length
    ? await prisma.asset.findMany({ where: { id: { in: assetIds } }, select: { id: true, storageKey: true } })
    : [];
  const urlByAssetId = new Map(assets.map((a) => [a.id, storage.getPublicUrl(a.storageKey)]));

  const withUrls = projects.map((p) => ({
    ...p,
    resultUrl: p.resultAssetId ? urlByAssetId.get(p.resultAssetId) ?? null : null,
  }));

  return apiSuccess({ projects: withUrls });
}

// POST /api/creative-projects — create + generate in one call; this
// endpoint's own contract is unchanged and still atomic (no draft row sits
// between create and generate). The AI Image wizard now runs its own
// client-side review step BEFORE ever calling this route — POST
// /api/creative-projects/enhance-prompt expands the user's short idea into
// a prompt the user can edit, and only the result of that becomes this
// call's `prompt`. Social Media/Marketing Creative still call this route
// directly with no review step. Charge order: see lib/creative/engine.ts's
// generateCreativeImage().
export async function POST(req: NextRequest) {
  // TEMPORARY — PRODUCTION_TRACE (2026-08-03). See
  // src/lib/observability/production-trace.ts for removal instructions.
  const traceId = newTraceId();
  const reqStart = Date.now();
  traceStep(traceId, "1_BROWSER", "PASS", 0, "request received");

  const authStart = Date.now();
  const session = await requireSession();
  if (!session) {
    traceStep(traceId, "3_AUTHENTICATION", "FAIL", Date.now() - authStart, "no session");
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }
  traceStep(traceId, "3_AUTHENTICATION", "PASS", Date.now() - authStart, { userId: session.user.id });

  try {
    const rateLimit = await checkRateLimit("creative_create", session.user.id);
    if (!rateLimit.allowed) {
      traceStep(traceId, "4_DATABASE", "FAIL", 0, "rate limited");
      return apiError(
        "ERR_RATE_LIMIT",
        "You've hit the hourly limit for creative generation. Please try again later.",
        429,
        { retryAfterSeconds: rateLimit.retryAfterSeconds }
      );
    }

    const body = await req.json().catch(() => ({}));
    const data = createCreativeProjectSchema.parse(body);
    traceStep(traceId, "2_API", "PASS", 0, { kind: data.kind, presetKey: data.presetKey, promptEnhanced: data.promptEnhanced });

    const { project, assetId, qualityResult } = await generateCreativeImage(session.user.id, data, traceId);
    const storage = await getStorageProvider();
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });

    traceStep(traceId, "11_FINAL_RESPONSE", "PASS", Date.now() - reqStart, "201 success");
    return apiSuccess(
      {
        project: { ...project, resultUrl: asset ? storage.getPublicUrl(asset.storageKey) : null },
        quality: qualityResult,
      },
      201
    );
  } catch (err) {
    const realErrorDetail = err instanceof Error ? err.message : String(err);
    traceStep(traceId, "11_FINAL_RESPONSE", "FAIL", Date.now() - reqStart, realErrorDetail);

    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the form and try again.", 400, { issues: err.issues });
    }
    if (err instanceof CreativeToolDisabledError) {
      return apiError("ERR_TOOL_DISABLED", err.message, 403);
    }
    if (err instanceof InsufficientCreditsError) {
      return apiError(
        "ERR_INSUFFICIENT_CREDITS",
        `You need ${err.required} credit(s) but only have ${err.available}. Buy more credits to continue.`,
        402
      );
    }
    console.error("POST /api/creative-projects failed", err);
    const message = err instanceof Error ? err.message : "Something went wrong generating your creative.";
    return apiError("ERR_INTERNAL", message, 500);
  }
}
