import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getStorageProvider } from "@/lib/providers/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;
  const project = await prisma.creativeProject.findFirst({ where: { id, userId: session.user.id } });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Creative project not found.", 404);
  }

  let resultUrl: string | null = null;
  if (project.resultAssetId) {
    const asset = await prisma.asset.findUnique({ where: { id: project.resultAssetId } });
    if (asset) {
      const storage = await getStorageProvider();
      resultUrl = storage.getPublicUrl(asset.storageKey);
    }
  }

  return apiSuccess({ project: { ...project, resultUrl } });
}
