import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";

const putSchema = z.object({
  // Production Hardening (2026-08-03) — optimistic concurrency, using the
  // template's own existing `updatedAt` (no new version column — this is
  // the only real timestamp on the row, and nothing else in this codebase
  // already implements this pattern to copy verbatim). The caller must
  // echo back the `updatedAt` it last fetched; a mismatch means someone
  // else changed this template (any field, not just its assets) since,
  // and this request must not blindly overwrite that.
  expectedUpdatedAt: z.string().min(1),
  assets: z.array(
    z.object({
      assetId: z.string().trim().min(1),
      role: z.enum(["STYLE", "COMPOSITION", "LIGHTING", "COLOR", "TYPOGRAPHY", "BRANDING"]).nullable().optional(),
    })
  ),
});

// Thrown INSIDE the transaction below to trigger a rollback on a lost
// compare-and-swap — never exported, never meant to escape this file's own
// catch.
class ReferenceAssetsConflictError extends Error {}

// PUT /api/admin/marketing-templates/[id]/assets — replaces the template's
// entire ordered reference-asset list in one call (Migration v3,
// 2026-08-02). Full-replace (not incremental add/remove) so a future
// drag-and-drop reorder can just POST the new order back — the position
// column is recomputed here as gapped integers (1000, 2000, ...), never by
// the client, so the gap strategy stays centralized in one place.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Invalid reference asset list.", 400, { issues: parsed.error.issues });
  }

  const template = await prisma.marketingTemplate.findUnique({ where: { id } });
  if (!template) return apiError("ERR_NOT_FOUND", "Marketing template not found.", 404);

  const expectedUpdatedAt = new Date(parsed.data.expectedUpdatedAt);
  if (Number.isNaN(expectedUpdatedAt.getTime())) {
    return apiError("ERR_VALIDATION", "Invalid expectedUpdatedAt.", 400);
  }

  const assetIds = parsed.data.assets.map((a) => a.assetId);
  const uniqueAssetIds = new Set(assetIds);
  if (uniqueAssetIds.size !== assetIds.length) {
    return apiError("ERR_VALIDATION", "The same asset can't be listed twice.", 400);
  }

  if (assetIds.length > 0) {
    const foundCount = await prisma.asset.count({ where: { id: { in: assetIds } } });
    if (foundCount !== assetIds.length) {
      return apiError("ERR_VALIDATION", "One or more of these assets no longer exist.", 400);
    }
  }

  try {
    const referenceAssets = await prisma.$transaction(async (tx) => {
      // Atomic compare-and-swap — the WHERE clause (id AND updatedAt) is
      // evaluated by Postgres as one statement, so this can never lose a
      // race the way a separate "read updatedAt, then write" check would:
      // if a concurrent request already committed a different updatedAt,
      // this matches zero rows regardless of timing. Also bumps updatedAt
      // for whichever request wins, so a THIRD concurrent request's own
      // stale expectedUpdatedAt correctly fails too, not just the second.
      const claim = await tx.marketingTemplate.updateMany({
        where: { id, updatedAt: expectedUpdatedAt },
        data: { updatedAt: new Date() },
      });
      if (claim.count === 0) {
        throw new ReferenceAssetsConflictError();
      }

      await tx.marketingTemplateAsset.deleteMany({ where: { templateId: id } });
      if (parsed.data.assets.length > 0) {
        await tx.marketingTemplateAsset.createMany({
          data: parsed.data.assets.map((a, index) => ({
            templateId: id,
            assetId: a.assetId,
            role: a.role ?? null,
            position: (index + 1) * 1000,
          })),
        });
      }
      return tx.marketingTemplateAsset.findMany({
        where: { templateId: id },
        include: { asset: { select: { id: true, storageKey: true, mimeType: true } } },
        orderBy: { position: "asc" },
      });
    });

    return apiSuccess({ referenceAssets });
  } catch (err) {
    if (err instanceof ReferenceAssetsConflictError) {
      return apiError(
        "ERR_CONFLICT",
        "This template was changed by someone else since you loaded it. Reload and try again.",
        409
      );
    }
    throw err;
  }
}
