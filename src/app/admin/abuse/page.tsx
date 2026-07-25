import { AbuseTable } from "./abuse-table";

export default function AdminAbusePage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Abuse detection</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Rule-based flags — excessive rate-limit hits or unusually fast AI-generation credit burn. Read-only;
          suspending an account is a manual decision here.
        </p>
      </div>
      <AbuseTable />
    </div>
  );
}
