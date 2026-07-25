import { PaymentsDashboard } from "./payments-dashboard";

export default function AdminPaymentsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Payments</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Payment intents, webhook delivery, and refunds. Enable/disable/priority/test-connection for
          the PAYMENT provider itself lives on the AI Providers page — this is the payments-specific
          view on top of that.
        </p>
      </div>
      <PaymentsDashboard />
    </div>
  );
}
