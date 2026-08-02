import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/shared/container";
import { getStorageProvider } from "@/lib/providers/storage";
import { GenerateForm } from "./generate-form";

// GET /marketing-templates/[id] — Migration v3 (2026-08-02): no more
// placeholder-driven dynamic form. The user only ever supplies their own
// image/video upload — the Master Prompt itself is never shown or editable
// here (see GenerateForm, which no longer receives it or any placeholder
// list at all).
export default async function MarketingTemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const template = await prisma.marketingTemplate.findFirst({
    where: { id, isActive: true, promptTemplate: { not: "" }, primaryProviderId: { not: null } },
    include: { referenceAssets: { include: { asset: true }, orderBy: { position: "asc" } } },
  });
  if (!template) notFound();

  const storage = await getStorageProvider();
  const referenceMediaUrls = template.referenceAssets.map((ref) => storage.getPublicUrl(ref.asset.storageKey));

  return (
    <Container className="flex max-w-3xl flex-col gap-8 py-10">
      <div>
        <h1 className="text-heading-1 text-dash-ink">{template.name}</h1>
        {template.description && <p className="mt-1 text-body-md text-dash-ink/55">{template.description}</p>}
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-label-sm text-dash-ink/55">Reference style</p>
          {referenceMediaUrls.length === 0 ? (
            <div className="flex aspect-video items-center justify-center rounded-card border border-dashed border-edge-card bg-glass-subtle text-body-sm text-dash-ink/40">
              No reference style for this template
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="overflow-hidden rounded-card border border-edge-card bg-glass-subtle">
                {template.outputType === "VIDEO" ? (
                  <video src={referenceMediaUrls[0]} className="aspect-video w-full object-cover" controls muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={referenceMediaUrls[0]} alt={template.name} className="aspect-video w-full object-cover" />
                )}
              </div>
              {referenceMediaUrls.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {referenceMediaUrls.slice(1).map((url, index) =>
                    template.outputType === "VIDEO" ? (
                      <video key={index} src={url} className="h-16 w-24 shrink-0 rounded-lg border border-edge-card object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={index} src={url} alt="" className="h-16 w-24 shrink-0 rounded-lg border border-edge-card object-cover" />
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <GenerateForm
          templateId={template.id}
          outputType={template.outputType}
          userAssetRequired={template.userAssetRequired}
        />
      </div>
    </Container>
  );
}
