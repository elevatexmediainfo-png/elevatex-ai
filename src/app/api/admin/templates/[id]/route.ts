import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";

const VIDEO_OBJECTIVES = ["PROMOTION", "NEW_LAUNCH", "FESTIVAL_GREETING", "TESTIMONIAL", "ANNOUNCEMENT", "OFFER_DISCOUNT", "BRAND_AWARENESS"] as const;

const patchSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  thumbnailUrl: z.string().trim().max(500).nullable().optional(),
  creditCost: z.number().int().min(0).optional(),
  includeVoiceover: z.boolean().optional(),
  promptTemplate: z.string().trim().min(1).max(4000).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  defaultObjective: z.enum(VIDEO_OBJECTIVES).nullable().optional(),
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

  const template = await prisma.template.update({ where: { id }, data: parsed.data });
  return apiSuccess({ template });
}
