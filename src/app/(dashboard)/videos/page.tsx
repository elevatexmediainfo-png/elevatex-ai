import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { VideoStatusBadge } from "@/components/shared/video-status-badge";
import { formatDate } from "@/lib/format";

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { type } = await searchParams;
  const isTalkingHead = type === "talking_head";

  const projects = await prisma.videoProject.findMany({
    where: { userId: session.user.id, sourceType: isTalkingHead ? "TALKING_HEAD_UPLOAD" : "GENERATED" },
    orderBy: { createdAt: "desc" },
    include: { template: { select: { name: true } } },
  });

  return (
    <Container className="flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-1 text-dash-ink">{isTalkingHead ? "Talking Head Videos" : "My Videos"}</h1>
          <p className="mt-1 text-body-md text-dash-ink/55">
            {isTalkingHead
              ? "Every talking-head video you've created from an uploaded clip."
              : "Every AI-generated video, from script to render."}
          </p>
        </div>
        {/* B4 Phase 1 (2026-07-22) — the "new" CTA no longer creates another
            legacy TALKING_HEAD_UPLOAD project; it routes into the Cloud
            Video Editor's upload flow instead. This page still lists
            existing legacy projects (below) — only the CREATE action moved. */}
        <Button asChild variant="primary" size="default">
          <Link href={isTalkingHead ? "/create/ai-auto-edit" : "/create"}>
            <Plus className="size-4" /> {isTalkingHead ? "New talking head" : "Create video"}
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-card bg-glass-card py-16 text-center backdrop-blur-xl">
          <Sparkles className="size-8 text-dash-ink/20" />
          <p className="text-body-md text-dash-ink/55">
            {isTalkingHead ? "You haven't created any talking-head videos yet." : "You haven't created any videos yet."}
          </p>
          <Button asChild variant="primary" size="default" className="mt-2">
            <Link href={isTalkingHead ? "/create/ai-auto-edit" : "/create"}>
              {isTalkingHead ? "Create your first talking head" : "Create your first video"}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/videos/${p.id}`}
              className="flex items-center justify-between gap-4 rounded-card border border-edge-card bg-glass-card p-4 backdrop-blur-xl transition-colors hover:border-edge-hover"
            >
              <div className="flex items-center gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-glass-subtle">
                  {p.previewThumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.previewThumbnailUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <Sparkles className="size-5 text-dash-ink/45" />
                  )}
                </div>
                <div>
                  <p className="text-label-lg text-dash-ink">{p.title}</p>
                  <p className="mt-0.5 text-body-sm text-dash-ink/55">
                    {p.template?.name ?? "Custom"} · {formatDate(p.createdAt)}
                  </p>
                </div>
              </div>
              <VideoStatusBadge status={p.status} />
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
