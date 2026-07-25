import { TemplatesManager } from "./templates-manager";

export default function AdminTemplatesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Templates</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Browse, create, and curate Video templates — toggle Active/Featured and tag a default
          objective so the Dashboard&apos;s &quot;Trending Templates&quot; row can filter on it.
        </p>
      </div>
      <TemplatesManager />
    </div>
  );
}
