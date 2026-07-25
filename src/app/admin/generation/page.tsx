import { GenerationDashboard } from "./generation-dashboard";

export default function AdminGenerationPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Generation Engine</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Failover, retry, timeout, and cost-tracking policy for every LLM/Image/Voice/Video
          provider call, plus live provider health and usage analytics.
        </p>
      </div>
      <GenerationDashboard />
    </div>
  );
}
