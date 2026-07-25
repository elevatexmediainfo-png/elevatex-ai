import { MarketingTemplatesManager } from "./marketing-templates-manager";

export default function AdminMarketingTemplatesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Marketing Templates</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Prompt+reference templates users personalize with their own logo and a few text fields —
          name, category, reference image/video, a prompt with {"{{placeholders}}"}, output type, aspect
          ratio, and which real generation provider to prefer. A template only appears in the user-facing
          gallery once it has real reference media and a real prompt set.
        </p>
      </div>
      <MarketingTemplatesManager />
    </div>
  );
}
