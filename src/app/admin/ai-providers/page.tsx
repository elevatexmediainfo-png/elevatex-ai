import { AIProvidersDashboard } from "./ai-providers-dashboard";

export default function AdminAIProvidersPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">AI Providers</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Enable a provider, paste its API key, set its budget/rate limit, and save — no code, no
          redeploy. Failover order is whatever priority you set across the enabled providers in a
          category.
        </p>
      </div>
      <AIProvidersDashboard />
    </div>
  );
}
