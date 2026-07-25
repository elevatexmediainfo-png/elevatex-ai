import { BroadcastForm } from "./broadcast-form";

export default function AdminNotificationsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Notifications</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Send an in-app (and optionally email) announcement to every user, or a specific list of user ids.
        </p>
      </div>
      <BroadcastForm />
    </div>
  );
}
