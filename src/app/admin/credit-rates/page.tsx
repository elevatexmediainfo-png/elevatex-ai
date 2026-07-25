import { CreditRatesDashboard } from "./credit-rates-dashboard";

export default function AdminCreditRatesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Credit Rates</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Every real billable action and what it currently deducts from a user&apos;s credit balance —
          aggregated from its real source (config or DB row) rather than a new pricing table.
          Video-action changes take effect within ~30 seconds (the config cache TTL); Creative
          Tool / Marketing Template changes take effect immediately.
        </p>
      </div>
      <CreditRatesDashboard />
    </div>
  );
}
