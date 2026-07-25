import { SubscriptionsDashboard } from "./subscriptions-dashboard";

export default function AdminSubscriptionsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Subscriptions</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Active and past subscriptions. Plan price/billing-interval/trial-days live on the
          Pricing &amp; Credits page — this view is for inspecting individual subscribers and, if
          needed, cancelling one immediately (separate from the user-facing cancel-at-period-end
          flow).
        </p>
      </div>
      <SubscriptionsDashboard />
    </div>
  );
}
