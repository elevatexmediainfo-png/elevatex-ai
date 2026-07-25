import { RevenueDashboard } from "./revenue-dashboard";

export default function AdminRevenuePage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Revenue</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Total revenue, MRR/ARR, and top-earning plans — derived from settled PaymentIntent and
          ACTIVE Subscription rows, not AI vendor cost (see Cost Management for that).
        </p>
      </div>
      <RevenueDashboard />
    </div>
  );
}
