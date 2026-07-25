import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { Container } from "@/components/shared/container";
import { AnimatedPosterPicker, type PosterOption } from "./animated-poster-picker";

// 4-option restructure Step 3 (2026-07-11) — real poster picker + generate
// flow, replacing the Step 2 placeholder. Server component fetches the
// user's posters (same query/URL-resolution shape as
// marketing-creatives/page.tsx, deliberately reused rather than
// reinvented); the actual click-to-select + generate + result interaction
// lives in the client component below, which didn't exist anywhere in the
// app yet.
export default async function CreateAnimatedPosterPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Scoped tighter than marketing-creatives' own gallery query
  // (status: COMPLETED, resultAssetId set) — a DRAFT/FAILED CreativeProject
  // has nothing real to animate, and generateAnimatedPosterVideo() itself
  // only ever checks the Asset exists, not the project's status, so this
  // filter is a picker-specific UX choice, not something the backend
  // already enforces.
  const projects = await prisma.creativeProject.findMany({
    where: {
      userId: session.user.id,
      kind: "MARKETING_CREATIVE",
      status: "COMPLETED",
      resultAssetId: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  const storage = await getStorageProvider();
  const assetIds = projects.map((p) => p.resultAssetId).filter((id): id is string => Boolean(id));
  const assets = assetIds.length
    ? await prisma.asset.findMany({ where: { id: { in: assetIds } }, select: { id: true, storageKey: true } })
    : [];
  const urlByAssetId = new Map(assets.map((a) => [a.id, storage.getPublicUrl(a.storageKey)]));

  const posters: PosterOption[] = projects
    .map((p) => {
      const url = p.resultAssetId ? urlByAssetId.get(p.resultAssetId) : undefined;
      if (!p.resultAssetId || !url) return null;
      return { id: p.id, posterAssetId: p.resultAssetId, title: p.title, createdAt: p.createdAt.toISOString(), url };
    })
    .filter((p): p is PosterOption => p !== null);

  return (
    <Container className="flex flex-col gap-6 py-10">
      <AnimatedPosterPicker posters={posters} />
    </Container>
  );
}
