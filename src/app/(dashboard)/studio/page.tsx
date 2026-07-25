import Link from "next/link";
import { redirect } from "next/navigation";
import { Clapperboard, Plus, Sparkles } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { formatDate } from "@/lib/format";

// AI Studio hub — the flagship Professional AI Video Editor's landing page.
// Lists every project still studio-eligible (DRAFT/SCRIPT_READY — scenes
// still freely editable, see videos/[id]/studio/page.tsx's own gate) with a
// Resume button straight into the Studio workspace.
export default async function StudioHubPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const resumable = await prisma.videoProject.findMany({
    where: { userId: session.user.id, status: { in: ["DRAFT", "SCRIPT_READY"] } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <Container className="flex flex-col gap-8 py-10">
      <div className="rounded-2xl bg-gradient-to-br from-brand-navy to-indigo-600 p-8 text-white">
        <p className="text-label-sm uppercase tracking-wide text-white/70">Flagship feature</p>
        <h1 className="mt-1 text-heading-1 text-white">AI Studio</h1>
        <p className="mt-2 max-w-xl text-body-md text-white/80">
          The professional AI video editor — timeline, B-roll, captions, voice, scene replace, transitions,
          background music, and auto zoom, all AI-assisted.
        </p>
        <Button asChild variant="primary" size="lg" className="mt-6">
          <Link href="/create">
            <Plus className="size-4" /> Start a new video
          </Link>
        </Button>
      </div>

      <div>
        <h2 className="text-heading-3 text-neutral-900">Resume editing</h2>
        {resumable.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-white py-12 text-center">
            <Clapperboard className="size-7 text-neutral-300" />
            <p className="text-body-md text-neutral-500">Nothing in progress — start a new video to use the Studio.</p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {resumable.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="size-5 text-brand-navy" />
                  <div>
                    <p className="text-label-lg text-neutral-900">{p.title}</p>
                    <p className="mt-0.5 text-body-sm text-neutral-500">Last edited {formatDate(p.updatedAt)}</p>
                  </div>
                </div>
                <Button asChild variant="primary" size="sm">
                  <Link href={`/videos/${p.id}/studio`}>Resume</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}
