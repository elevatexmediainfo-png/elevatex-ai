import { StorageDashboard } from "./storage-dashboard";

export default function AdminStoragePage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Storage</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Asset usage by kind/source and the configured Storage Provider&apos;s live reachability.
        </p>
      </div>
      <StorageDashboard />
    </div>
  );
}
