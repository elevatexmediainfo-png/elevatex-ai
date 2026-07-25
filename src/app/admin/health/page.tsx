import { HealthDashboardClient } from "./health-dashboard-client";

export default function AdminHealthPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">System Health</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Database, cache, storage, queue, and AI provider health in one place — plus the most recent application
          errors.
        </p>
      </div>
      <HealthDashboardClient />
    </div>
  );
}
