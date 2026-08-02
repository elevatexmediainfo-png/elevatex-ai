import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { ASPECT_RATIOS_BY_OUTPUT_TYPE } from "@/lib/marketing-templates/aspect-ratios";
import { getStorageProvider } from "@/lib/providers/storage";
import { logger } from "@/lib/observability/logger";

// TEMP_DEBUG (2026-08-03) — request-lifecycle logging added solely to
// diagnose the "Add Template doesn't appear" production report. No
// behavior change. Remove this whole block, and every `logger.info(
// { tempDebug: true, ... })` call below, once the investigation
// concludes — grep "TEMP_DEBUG" to find every touch point.

// Marketing Templates (2026-07-24) — admin CRUD for the new
// MarketingTemplate model (see prisma/schema.prisma's own comment for why
// this is a separate model from the existing Template/CreativeTool). Same
// zod-inline / requireAdminSession / apiSuccess-apiError shape as every
// other admin CRUD route in this codebase (creative-tools, templates).
//
// The outputType/aspectRatio .refine() below is the server-side half of
// ASPECT_RATIOS_BY_OUTPUT_TYPE's real Veo constraint (see that file's own
// comment) — the admin manager's Select already filters this client-side,
// but a direct API call must be rejected too, never trusted client-only.
// Migration v3 (2026-08-02) — preferredProviderId replaced by
// primaryProviderId/fallbackProviderId (the user never picks a provider —
// it's always admin-locked). Both stay optional at CREATE time, same as
// promptTemplate — the founder's own established two-step workflow
// (create a bare shell, fill in the rest on the card that appears) applies
// here too; a template with no primaryProviderId is simply not "ready"
// (see isReady/generateFromMarketingTemplate's own gate), same as a
// missing prompt today. fallbackProviderId, if given, must differ from
// primaryProviderId — otherwise "Primary -> Fallback" is a no-op.
const createSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().max(500).nullable().optional(),
    category: z.string().trim().max(60).nullable().optional(),
    outputType: z.enum(["IMAGE", "VIDEO"]),
    aspectRatio: z.enum(["RATIO_9_16", "RATIO_1_1", "RATIO_16_9"]),
    promptTemplate: z.string().trim().max(4000).default(""),
    primaryProviderId: z.string().trim().min(1).max(60).nullable().optional(),
    fallbackProviderId: z.string().trim().min(1).max(60).nullable().optional(),
    userAssetRequired: z.boolean().default(false),
    creditCost: z.number().int().min(0).default(1),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    sortOrder: z.number().int().default(0),
  })
  .refine((data) => ASPECT_RATIOS_BY_OUTPUT_TYPE[data.outputType].includes(data.aspectRatio), {
    message: "This aspect ratio isn't supported for this output type (Veo doesn't support 1:1 video).",
    path: ["aspectRatio"],
  })
  .refine((data) => !data.fallbackProviderId || data.fallbackProviderId !== data.primaryProviderId, {
    message: "Fallback Provider must be different from Primary Provider.",
    path: ["fallbackProviderId"],
  });

export async function GET() {
  logger.info({ tempDebug: true, route: "GET /api/admin/marketing-templates" }, "TEMP_DEBUG: request received");

  const session = await requireAdminSession();
  if (!session) {
    logger.info({ tempDebug: true, route: "GET /api/admin/marketing-templates" }, "TEMP_DEBUG: not authenticated as admin, returning 403");
    return apiError("ERR_FORBIDDEN", "Admin access required.", 403);
  }
  logger.info({ tempDebug: true, userId: session.user.id }, "TEMP_DEBUG: authenticated user");

  const templates = await prisma.marketingTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      referenceAssets: { include: { asset: { select: { id: true, storageKey: true, mimeType: true } } }, orderBy: { position: "asc" } },
      _count: { select: { generations: true } },
    },
  });

  // New admin UI (2026-08-03) — reference assets need a real preview, not
  // just a mimeType label; resolves each one's public URL server-side
  // (storageKey alone isn't a fetchable URL client-side — same pattern
  // the user-facing gallery/detail pages already use via
  // storage.getPublicUrl()). Additive field only, existing consumers of
  // this response are unaffected.
  const storage = await getStorageProvider();
  const templatesWithUrls = templates.map((t) => ({
    ...t,
    referenceAssets: t.referenceAssets.map((ref) => ({
      ...ref,
      asset: { ...ref.asset, url: storage.getPublicUrl(ref.asset.storageKey) },
    })),
  }));

  logger.info(
    { tempDebug: true, count: templates.length, ids: templates.map((t) => t.id) },
    "TEMP_DEBUG: templates returned"
  );

  logger.info({ tempDebug: true, status: 200 }, "TEMP_DEBUG: response status");
  return apiSuccess({ templates: templatesWithUrls });
}

export async function POST(req: NextRequest) {
  logger.info({ tempDebug: true, route: "POST /api/admin/marketing-templates" }, "TEMP_DEBUG: request received");

  const session = await requireAdminSession();
  if (!session) {
    logger.info({ tempDebug: true, route: "POST /api/admin/marketing-templates" }, "TEMP_DEBUG: not authenticated as admin, returning 403");
    return apiError("ERR_FORBIDDEN", "Admin access required.", 403);
  }
  logger.info({ tempDebug: true, userId: session.user.id }, "TEMP_DEBUG: authenticated user");

  const body = await req.json().catch(() => ({}));
  logger.info({ tempDebug: true, body }, "TEMP_DEBUG: request body");

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    logger.info({ tempDebug: true, issues: parsed.error.issues, status: 400 }, "TEMP_DEBUG: validation failed");
    return apiError("ERR_VALIDATION", "Invalid marketing template.", 400, { issues: parsed.error.issues });
  }

  const template = await prisma.marketingTemplate.create({ data: parsed.data });
  logger.info(
    { tempDebug: true, insertedId: template.id, insertedName: template.name, createdAt: template.createdAt },
    "TEMP_DEBUG: database insert result"
  );

  logger.info({ tempDebug: true, status: 201 }, "TEMP_DEBUG: response status");
  return apiSuccess({ template }, 201);
}
