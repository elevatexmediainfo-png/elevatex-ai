import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { ASPECT_RATIOS_BY_OUTPUT_TYPE } from "@/lib/marketing-templates/aspect-ratios";

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
const createSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().max(500).nullable().optional(),
    category: z.string().trim().max(60).nullable().optional(),
    outputType: z.enum(["IMAGE", "VIDEO"]),
    aspectRatio: z.enum(["RATIO_9_16", "RATIO_1_1", "RATIO_16_9"]),
    promptTemplate: z.string().trim().max(4000).default(""),
    preferredProviderId: z.string().trim().max(60).nullable().optional(),
    creditCost: z.number().int().min(0).default(1),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    sortOrder: z.number().int().default(0),
  })
  .refine((data) => ASPECT_RATIOS_BY_OUTPUT_TYPE[data.outputType].includes(data.aspectRatio), {
    message: "This aspect ratio isn't supported for this output type (Veo doesn't support 1:1 video).",
    path: ["aspectRatio"],
  });

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const templates = await prisma.marketingTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { referenceMediaAsset: { select: { id: true, storageKey: true, mimeType: true } }, _count: { select: { generations: true } } },
  });
  return apiSuccess({ templates });
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Invalid marketing template.", 400, { issues: parsed.error.issues });
  }

  const template = await prisma.marketingTemplate.create({ data: parsed.data });
  return apiSuccess({ template }, 201);
}
