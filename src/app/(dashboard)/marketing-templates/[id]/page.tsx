import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/shared/container";
import { getStorageProvider } from "@/lib/providers/storage";
import { extractPlaceholders } from "@/lib/marketing-templates/placeholders";
import { GenerateForm } from "./generate-form";

// GET /marketing-templates/[id] — the real form is generated FROM the
// template's own {{placeholders}}, never a hardcoded field list (see
// lib/marketing-templates/placeholders.ts, the one place that knows the
// syntax — shared with the admin preview and the generation route itself).
export default async function MarketingTemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const template = await prisma.marketingTemplate.findFirst({
    where: { id, isActive: true, referenceMediaAssetId: { not: null }, promptTemplate: { not: "" } },
    include: { referenceMediaAsset: true },
  });
  if (!template) notFound();

  const placeholders = extractPlaceholders(template.promptTemplate);
  const storage = await getStorageProvider();
  const referenceMediaUrl = storage.getPublicUrl(template.referenceMediaAsset!.storageKey);

  return (
    <Container className="flex max-w-3xl flex-col gap-8 py-10">
      <div>
        <h1 className="text-heading-1 text-dash-ink">{template.name}</h1>
        {template.description && <p className="mt-1 text-body-md text-dash-ink/55">{template.description}</p>}
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-label-sm text-dash-ink/55">Reference style</p>
          <div className="overflow-hidden rounded-card border border-edge-card bg-glass-subtle">
            {template.outputType === "VIDEO" ? (
              <video src={referenceMediaUrl} className="aspect-video w-full object-cover" controls muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={referenceMediaUrl} alt={template.name} className="aspect-video w-full object-cover" />
            )}
          </div>
        </div>

        <GenerateForm
          templateId={template.id}
          placeholders={placeholders}
          outputType={template.outputType}
          creditCost={template.creditCost}
        />
      </div>
    </Container>
  );
}
