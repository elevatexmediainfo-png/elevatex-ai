import { CommandCenterDashboard } from "./command-center-dashboard";

export default function AdminCommandCenterPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Founder Command Center</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Everything that needs a founder&apos;s attention right now, in one place. Each alert links
          straight to the admin page that has the actual fix — provider outages, spend spikes, and
          storage need a real decision, not a blind auto-action.
        </p>
      </div>
      <CommandCenterDashboard />
    </div>
  );
}
