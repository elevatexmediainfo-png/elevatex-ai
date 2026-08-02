import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/shared/container";
import { Badge } from "@/components/ui/badge";
import { getStorageProvider } from "@/lib/providers/storage";

// GET /marketing-templates — the user-facing gallery (2026-07-24, simplified
// in Migration v3 on 2026-08-02). Same "no fake UI" rule the admin manager
// enforces server-side too, not just client-side cosmetics: a template only
// appears here once it genuinely has a real Master Prompt AND a real
// Primary Provider set — the exact same isReady condition
// generateFromMarketingTemplate() re-checks before allowing a generation,
// so a template can never be browsable-but-unusable or vice versa. Reference
// assets are optional (per the founder's own spec), so a gallery card falls
// back to a plain icon tile when a template has none.
export default async function MarketingTemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const templates = await prisma.marketingTemplate.findMany({
    where: {
      isActive: true,
      promptTemplate: { not: "" },
      primaryProviderId: { not: null },
    },
    include: { referenceAssets: { include: { asset: true }, orderBy: { position: "asc" }, take: 1 } },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  const storage = await getStorageProvider();

  return (
    <Container className="flex flex-col gap-6 py-10">
      <div>
        <h1 className="text-heading-1 text-dash-ink">Marketing Templates</h1>
        <p className="mt-1 text-body-md text-dash-ink/55">
          Upload your own image or video and generate a personalized marketing image or video from a real
          reference style.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-card bg-glass-card py-16 text-center backdrop-blur-xl">
          <Sparkles className="size-8 text-dash-ink/20" />
          <p className="text-body-md text-dash-ink/55">No templates available yet — check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const cover = t.referenceAssets[0]?.asset ?? null;
            const mediaUrl = cover ? storage.getPublicUrl(cover.storageKey) : null;
            return (
              <Link
                key={t.id}
                href={`/marketing-templates/${t.id}`}
                className="flex flex-col overflow-hidden rounded-card border border-edge-card bg-glass-card backdrop-blur-xl transition-colors hover:border-edge-hover"
              >
                <div className="flex aspect-video items-center justify-center overflow-hidden bg-glass-subtle">
                  {!mediaUrl ? (
                    <Sparkles className="size-8 text-dash-ink/20" />
                  ) : t.outputType === "VIDEO" ? (
                    <video src={mediaUrl} className="size-full object-cover" muted playsInline preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl} alt={t.name} className="size-full object-cover" />
                  )}
                </div>
                <div className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-label-lg text-dash-ink">{t.name}</p>
                    {t.isFeatured && <Badge variant="brand" outline>Featured</Badge>}
                  </div>
                  {t.description && <p className="text-body-sm text-dash-ink/55">{t.description}</p>}
                  <div className="mt-1 flex items-center gap-3 text-label-sm text-dash-ink/55">
                    {t.category && <span>{t.category}</span>}
                    <span>·</span>
                    <span>{t.outputType === "VIDEO" ? "Video" : "Image"}</span>
                    <span>·</span>
                    {/* Permanent free tier (2026-08-02) — Marketing Templates never
                        actually charge (see generate.ts); showing the template's
                        own nominal creditCost here would contradict that. */}
                    <span className="text-success">Free</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Container>
  );
}
