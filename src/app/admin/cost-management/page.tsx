import { CostManagementDashboard } from "./cost-management-dashboard";

export default function AdminCostManagementPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Cost Management</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Vendor spend broken down by provider, model, project, user, and subscription plan — derived
          entirely from generation logs, so it never drifts from what actually ran.
        </p>
      </div>
      <CostManagementDashboard />
    </div>
  );
}
