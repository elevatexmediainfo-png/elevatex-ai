import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";

const patchSchema = z.object({
  label: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  icon: z.string().trim().min(1).max(60).optional(),
  gradientFrom: z.string().trim().max(20).nullable().optional(),
  gradientTo: z.string().trim().max(20).nullable().optional(),
  category: z.enum(["MAIN_CARD", "QUICK_ACTION", "COMING_SOON"]).optional(),
  pipeline: z
    .enum(["VIDEO", "IMAGE", "SOCIAL_MEDIA", "MARKETING_CREATIVE", "TALKING_HEAD", "BRAND_ASSET", "EXTERNAL"])
    .optional(),
  presetKey: z.string().trim().max(60).nullable().optional(),
  routeOverride: z.string().trim().max(200).nullable().optional(),
  creditCostEstimate: z.number().int().min(0).optional(),
  estimatedSeconds: z.number().int().min(0).optional(),
  promptTemplate: z.string().trim().max(2000).nullable().optional(),
  defaultProviderId: z.string().trim().max(60).nullable().optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Invalid update.", 400, { issues: parsed.error.issues });
  }

  const tool = await prisma.creativeTool.update({ where: { id }, data: parsed.data });
  return apiSuccess({ tool });
}
