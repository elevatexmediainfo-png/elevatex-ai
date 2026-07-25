import { RenderDashboard } from "./render-dashboard";

export default function AdminRenderPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Render Pipeline</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Scene/merge render queue depth, concurrency policy, rendering analytics, and job history.
        </p>
      </div>
      <RenderDashboard />
    </div>
  );
}
