import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ImageIcon } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { CreativeStatusBadge } from "@/components/shared/creative-status-badge";
import { getStorageProvider } from "@/lib/providers/storage";
import { formatDate } from "@/lib/format";

export default async function ImagesPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { projectId } = await searchParams;

  const projects = await prisma.creativeProject.findMany({
    where: { userId: session.user.id, kind: "AI_IMAGE" },
    orderBy: { createdAt: "desc" },
  });

  const storage = await getStorageProvider();
  const assetIds = projects.map((p) => p.resultAssetId).filter((id): id is string => Boolean(id));
  const assets = assetIds.length
    ? await prisma.asset.findMany({ where: { id: { in: assetIds } }, select: { id: true, storageKey: true } })
    : [];
  const urlByAssetId = new Map(assets.map((a) => [a.id, storage.getPublicUrl(a.storageKey)]));

  return (
    <Container className="flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-1 text-dash-ink">AI Images</h1>
          <p className="mt-1 text-body-md text-dash-ink/55">Every standalone image you&apos;ve generated.</p>
        </div>
        <Button asChild variant="primary" size="default">
          <Link href="/create/image">
            <Plus className="size-4" /> New image
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-card bg-glass-card py-16 text-center backdrop-blur-xl">
          <ImageIcon className="size-8 text-dash-ink/20" />
          <p className="text-body-md text-dash-ink/55">You haven&apos;t generated any images yet.</p>
          <Button asChild variant="primary" size="default" className="mt-2">
            <Link href="/create/image">Create your first image</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {projects.map((p) => {
            const url = p.resultAssetId ? urlByAssetId.get(p.resultAssetId) : undefined;
            const isTarget = p.id === projectId;
            return (
              <div
                key={p.id}
                id={p.id}
                className={`overflow-hidden rounded-card border bg-glass-card backdrop-blur-xl ${
                  isTarget ? "border-violet-500 ring-2 ring-violet-500" : "border-edge-card"
                }`}
              >
                <div className="flex aspect-square items-center justify-center bg-glass-subtle">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={p.title} className="size-full object-cover" />
                  ) : (
                    <ImageIcon className="size-6 text-dash-ink/20" />
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-label-md text-dash-ink">{p.title}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-body-sm text-dash-ink/55">{formatDate(p.createdAt)}</p>
                    <CreativeStatusBadge status={p.status} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Container>
  );
}
