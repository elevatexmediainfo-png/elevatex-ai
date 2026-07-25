"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

type SubscriptionStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE";

interface SubscriptionRow {
  id: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  isTrialPeriod: boolean;
  user: { id: string; name: string | null; email: string | null; phone: string | null };
  plan: { id: string; name: string; billingInterval: string | null };
}

const STATUS_BADGE: Record<SubscriptionStatus, BadgeVariant> = {
  ACTIVE: "success",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
  PAST_DUE: "warning",
};

const STATUS_FILTERS: { label: string; value: SubscriptionStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Past due", value: "PAST_DUE" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Expired", value: "EXPIRED" },
];

export function SubscriptionsDashboard() {
  const [statusFilter, setStatusFilter] = React.useState<SubscriptionStatus | "ALL">("ALL");
  const [subscriptions, setSubscriptions] = React.useState<SubscriptionRow[] | null>(null);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    const qs = statusFilter === "ALL" ? "" : `?status=${statusFilter}`;
    fetch(`/api/admin/subscriptions${qs}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setSubscriptions(json.data.subscriptions);
      });
  }, [statusFilter]);

  React.useEffect(() => {
    setSubscriptions(null);
    load();
  }, [load]);

  async function cancelImmediately(id: string) {
    if (!window.confirm("Cancel this subscription immediately? This ends access right away, unlike the user's own cancel-at-period-end option.")) {
      return;
    }
    setCancellingId(id);
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}/cancel`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't cancel subscription.");
        return;
      }
      toast.success("Subscription cancelled.");
      load();
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            type="button"
            size="sm"
            variant={statusFilter === f.value ? "primary" : "secondary"}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-body-sm">
          <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
            <tr>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Current period</th>
              <th className="px-4 py-2">Trial</th>
              <th className="px-4 py-2">Cancel at period end</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {!subscriptions ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-500">
                  Loading…
                </td>
              </tr>
            ) : subscriptions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-500">
                  No subscriptions found.
                </td>
              </tr>
            ) : (
              subscriptions.map((sub) => (
                <tr key={sub.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2">{sub.user.name ?? sub.user.email ?? sub.user.phone ?? sub.user.id}</td>
                  <td className="px-4 py-2">
                    {sub.plan.name}
                    <span className="ml-1 text-caption text-neutral-500">
                      ({sub.plan.billingInterval ?? "MONTHLY"})
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={STATUS_BADGE[sub.status]}>{sub.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-neutral-500">
                    {formatDateTime(new Date(sub.currentPeriodStart))} → {formatDateTime(new Date(sub.currentPeriodEnd))}
                  </td>
                  <td className="px-4 py-2">{sub.isTrialPeriod ? <Badge variant="info">Trial</Badge> : "—"}</td>
                  <td className="px-4 py-2">{sub.cancelAtPeriodEnd ? "Yes" : "No"}</td>
                  <td className="px-4 py-2">
                    {(sub.status === "ACTIVE" || sub.status === "PAST_DUE") && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={cancellingId === sub.id}
                        onClick={() => cancelImmediately(sub.id)}
                      >
                        Cancel now
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
