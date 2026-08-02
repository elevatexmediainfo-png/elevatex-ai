import { MarketingTemplatesAdmin } from "./marketing-templates-admin";

export default function AdminMarketingTemplatesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Marketing Templates</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Admin-authored Prompt Template + reference-asset templates users generate from by uploading their
          own image or video — never a prompt they see or edit. Create a template above and it appears
          immediately below, fully editable right here — no separate page. A template only appears in the
          user-facing gallery once it has a real Prompt Template and a Primary Provider set.
        </p>
      </div>
      <MarketingTemplatesAdmin />
    </div>
  );
}
