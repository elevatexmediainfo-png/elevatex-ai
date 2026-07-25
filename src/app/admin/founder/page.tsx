import { FounderDashboard } from "./founder-dashboard";

export default function AdminFounderPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Founder Dashboard</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Today, at a glance — revenue, usage, AI cost, and a rough profit estimate. The estimate
          cards (profit, margin, cost saved, time saved, CLV, ARPU) combine INR revenue with USD
          vendor cost using an admin-set conversion rate and assumptions — treat them as a gut
          check, not exact accounting.
        </p>
      </div>
      <FounderDashboard />
    </div>
  );
}
