import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

import { auth } from "@/lib/auth";
import { VideoStatusBadge } from "@/components/shared/video-status-badge";
import { CreativeStatusBadge } from "@/components/shared/creative-status-badge";
import { Container } from "@/components/shared/container";
import { getContinueWorking } from "@/lib/dashboard/continue-working";
import { formatDate } from "@/lib/format";

const KIND_LABEL: Record<string, string> = {
  VIDEO: "AI Video",
  TALKING_HEAD: "Talking Head",
  IMAGE: "AI Image",
  MARKETING_CREATIVE: "Marketing Creative",
};

// Unified view across every project type — VideoProject (video + talking
// head) and CreativeProject (image + social/marketing) — one list, since
// the user thinks "my projects," not "my five separate project tables."
export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { all } = await getContinueWorking(session.user.id, 50);

  return (
    <Container className="flex flex-col gap-6 py-10">
      <div>
        <h1 className="text-heading-1 text-dash-ink">Projects</h1>
        <p className="mt-1 text-body-md text-dash-ink/55">Every video, talking head, image, and marketing creative — in one place.</p>
      </div>

      {all.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-card bg-glass-card py-16 text-center backdrop-blur-xl">
          <Sparkles className="size-8 text-dash-ink/20" />
          <p className="text-body-md text-dash-ink/55">You haven&apos;t created anything yet.</p>
          <Link href="/create" className="mt-2 text-label-md text-violet-400 hover:underline">
            Start creating
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {all.map((item) => (
            <Link
              key={`${item.kind}:${item.id}`}
              href={item.href}
              className="flex items-center justify-between gap-4 rounded-card border border-edge-card bg-glass-card p-4 backdrop-blur-xl transition-colors hover:border-edge-hover"
            >
              <div className="flex items-center gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-glass-subtle">
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbnailUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <Sparkles className="size-5 text-dash-ink/45" />
                  )}
                </div>
                <div>
                  <p className="text-label-lg text-dash-ink">{item.title}</p>
                  <p className="mt-0.5 text-body-sm text-dash-ink/55">
                    {KIND_LABEL[item.kind]} · {formatDate(item.updatedAt)}
                  </p>
                </div>
              </div>
              {item.kind === "VIDEO" || item.kind === "TALKING_HEAD" ? (
                <VideoStatusBadge status={item.status} />
              ) : (
                <CreativeStatusBadge status={item.status} />
              )}
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
