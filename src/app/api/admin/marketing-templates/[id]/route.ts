import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { ASPECT_RATIOS_BY_OUTPUT_TYPE } from "@/lib/marketing-templates/aspect-ratios";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  outputType: z.enum(["IMAGE", "VIDEO"]).optional(),
  aspectRatio: z.enum(["RATIO_9_16", "RATIO_1_1", "RATIO_16_9"]).optional(),
  promptTemplate: z.string().trim().max(4000).optional(),
  // Migration v3 (2026-08-02) — preferredProviderId replaced; see
  // route.ts's own comment for why both stay optional/nullable.
  primaryProviderId: z.string().trim().min(1).max(60).nullable().optional(),
  fallbackProviderId: z.string().trim().min(1).max(60).nullable().optional(),
  userAssetRequired: z.boolean().optional(),
  creditCost: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// GET — added for the dedicated template editor page (2026-08-04); the list
// route already returns every template with its referenceAssets included,
// this is the same shape for exactly one, so the editor doesn't have to
// fetch/filter the entire list just to load one template.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { id } = await params;
  const template = await prisma.marketingTemplate.findUnique({
    where: { id },
    include: {
      referenceAssets: { include: { asset: { select: { id: true, storageKey: true, mimeType: true } } }, orderBy: { position: "asc" } },
      _count: { select: { generations: true } },
    },
  });
  if (!template) return apiError("ERR_NOT_FOUND", "Marketing template not found.", 404);

  return apiSuccess({ template });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Invalid update.", 400, { issues: parsed.error.issues });
  }

  const existing = await prisma.marketingTemplate.findUnique({ where: { id } });
  if (!existing) return apiError("ERR_NOT_FOUND", "Marketing template not found.", 404);

  // Effective combination after this patch — either field alone can be
  // omitted from a given PATCH call, so this must check the merged result,
  // not just whatever's in the request body. Same real Veo constraint as
  // the create route (see ASPECT_RATIOS_BY_OUTPUT_TYPE's own comment).
  const effectiveOutputType = parsed.data.outputType ?? existing.outputType;
  const effectiveAspectRatio = parsed.data.aspectRatio ?? existing.aspectRatio;
  if (!ASPECT_RATIOS_BY_OUTPUT_TYPE[effectiveOutputType].includes(effectiveAspectRatio)) {
    return apiError("ERR_VALIDATION", "This aspect ratio isn't supported for this output type (Veo doesn't support 1:1 video).", 400);
  }

  // Same merged-result check as above — a PATCH that only sends
  // fallbackProviderId must still be validated against whatever
  // primaryProviderId already exists on the row, and vice versa.
  const effectivePrimary = parsed.data.primaryProviderId !== undefined ? parsed.data.primaryProviderId : existing.primaryProviderId;
  const effectiveFallback = parsed.data.fallbackProviderId !== undefined ? parsed.data.fallbackProviderId : existing.fallbackProviderId;
  if (effectiveFallback && effectiveFallback === effectivePrimary) {
    return apiError("ERR_VALIDATION", "Fallback Provider must be different from Primary Provider.", 400);
  }

  const template = await prisma.marketingTemplate.update({ where: { id }, data: parsed.data });
  return apiSuccess({ template });
}

// DELETE — a real hard delete, per the explicit "create/edit/delete"
// requirement (every other admin CRUD surface in this codebase uses
// isActive/enabled soft-disable instead, but nothing here asked for that).
// Refuses when the template has real generation history attached
// (MarketingTemplateGeneration.templateId cascades on delete) — losing a
// user's real past generations as a side effect of an admin housekeeping
// action would be a real, surprising data-loss bug, not a feature.
// Disabling via PATCH { isActive: false } is the correct action once a
// template has real history; delete is for a template nobody has used yet.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { id } = await params;
  const existing = await prisma.marketingTemplate.findUnique({ where: { id }, include: { _count: { select: { generations: true } } } });
  if (!existing) return apiError("ERR_NOT_FOUND", "Marketing template not found.", 404);

  if (existing._count.generations > 0) {
    return apiError(
      "ERR_INVALID_STATE",
      `This template has ${existing._count.generations} real generation${existing._count.generations === 1 ? "" : "s"} attached — disable it instead of deleting, so that history isn't lost.`,
      409
    );
  }

  await prisma.marketingTemplate.delete({ where: { id } });
  return apiSuccess({ deleted: true });
}
