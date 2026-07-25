"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminConfigForm } from "@/components/admin/admin-config-form";
import { formatDateTime } from "@/lib/format";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(0)}`;
}

interface PaymentIntentRow {
  id: string;
  userId: string;
  user: { id: string; name: string | null; email: string | null; phone: string | null };
  kind: "CREDIT_PACKAGE" | "SUBSCRIPTION" | "ONE_TIME_DOWNLOAD";
  amountPaise: number;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  providerOrderId: string | null;
  providerPaymentId: string | null;
  invoice: { id: string; invoiceNumber: number } | null;
  refunds: { id: string; amountPaise: number; status: string }[];
  createdAt: string;
}

interface WebhookEventRow {
  id: string;
  provider: string;
  eventType: string;
  status: "RECEIVED" | "PROCESSED" | "FAILED";
  signatureValid: boolean;
  errorMessage: string | null;
  receivedAt: string;
}

interface RefundRow {
  id: string;
  paymentIntentId: string;
  amountPaise: number;
  reason: string | null;
  status: "PENDING" | "PROCESSED" | "FAILED";
  createdAt: string;
}

const INTENT_STATUS_BADGE: Record<PaymentIntentRow["status"], BadgeVariant> = {
  PENDING: "neutral",
  PAID: "success",
  FAILED: "error",
  CANCELLED: "neutral",
};

const WEBHOOK_STATUS_BADGE: Record<WebhookEventRow["status"], BadgeVariant> = {
  RECEIVED: "info",
  PROCESSED: "success",
  FAILED: "error",
};

const REFUND_STATUS_BADGE: Record<RefundRow["status"], BadgeVariant> = {
  PENDING: "neutral",
  PROCESSED: "success",
  FAILED: "error",
};

export function PaymentsDashboard() {
  const [intents, setIntents] = React.useState<PaymentIntentRow[] | null>(null);
  const [webhooks, setWebhooks] = React.useState<WebhookEventRow[] | null>(null);
  const [refunds, setRefunds] = React.useState<RefundRow[] | null>(null);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  const [refundTarget, setRefundTarget] = React.useState<string | null>(null);
  const [refundAmount, setRefundAmount] = React.useState("");
  const [refunding, setRefunding] = React.useState(false);

  const loadIntents = React.useCallback(() => {
    fetch("/api/admin/payments?limit=50")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setIntents(json.data.intents);
      });
  }, []);

  const loadWebhooks = React.useCallback(() => {
    fetch("/api/admin/payments/webhooks?limit=50")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setWebhooks(json.data.events);
      });
  }, []);

  const loadRefunds = React.useCallback(() => {
    fetch("/api/admin/payments/refunds")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setRefunds(json.data.refunds);
      });
  }, []);

  React.useEffect(() => {
    loadIntents();
    loadWebhooks();
    loadRefunds();
  }, [loadIntents, loadWebhooks, loadRefunds]);

  async function handleRetryWebhook(id: string) {
    setRetryingId(id);
    try {
      const res = await fetch(`/api/admin/payments/webhooks/${id}/retry`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't retry this webhook event.");
        return;
      }
      toast.success("Webhook event re-dispatched.");
      loadWebhooks();
      loadIntents();
    } finally {
      setRetryingId(null);
    }
  }

  async function handleCreateRefund() {
    if (!refundTarget) return;
    const amountPaise = Math.round(Number(refundAmount) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      toast.error("Enter a valid refund amount.");
      return;
    }
    setRefunding(true);
    try {
      const res = await fetch("/api/admin/payments/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: refundTarget, amountPaise }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Refund failed.");
        return;
      }
      toast.success("Refund processed.");
      setRefundTarget(null);
      setRefundAmount("");
      loadRefunds();
      loadIntents();
    } finally {
      setRefunding(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <AdminConfigForm sections={[{ category: "payment_settings", title: "Payment methods" }]} />
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">Payment intents</h2>
        <p className="mt-1 text-body-sm text-neutral-500">Most recent 50 — refund directly from a PAID row.</p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-body-sm">
            <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
              <tr>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Kind</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {!intents || intents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-neutral-500">
                    {intents === null ? "Loading…" : "No payment intents yet."}
                  </td>
                </tr>
              ) : (
                intents.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2">{row.user.name ?? row.user.email ?? row.user.phone ?? row.userId}</td>
                    <td className="px-4 py-2">{row.kind}</td>
                    <td className="px-4 py-2">{formatRupees(row.amountPaise)}</td>
                    <td className="px-4 py-2">
                      <Badge variant={INTENT_STATUS_BADGE[row.status]} outline>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-neutral-500">
                      {row.invoice ? `#${row.invoice.invoiceNumber}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{formatDateTime(new Date(row.createdAt))}</td>
                    <td className="px-4 py-2">
                      {row.status === "PAID" && row.refunds.length === 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRefundTarget(row.id);
                            setRefundAmount((row.amountPaise / 100).toFixed(0));
                          }}
                        >
                          Refund
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

      {refundTarget && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="text-label-md text-neutral-900">Refund payment intent {refundTarget}</h3>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex h-9 items-center rounded-md border border-neutral-300 px-2 text-body-sm text-neutral-500">
              ₹
            </span>
            <Input
              inputMode="decimal"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="h-9 w-32 text-body-sm"
            />
            <Button type="button" variant="primary" size="sm" disabled={refunding} onClick={handleCreateRefund}>
              Confirm refund
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRefundTarget(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-label-lg text-neutral-900">Webhook events</h2>
        <p className="mt-1 text-body-sm text-neutral-500">
          Every inbound payment-provider webhook, regardless of outcome — retry re-runs the exact same
          dispatch logic against the stored payload.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-body-sm">
            <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
              <tr>
                <th className="px-4 py-2">Provider</th>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Signature</th>
                <th className="px-4 py-2">Error</th>
                <th className="px-4 py-2">Received</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {!webhooks || webhooks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-neutral-500">
                    {webhooks === null ? "Loading…" : "No webhook events yet."}
                  </td>
                </tr>
              ) : (
                webhooks.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2">{row.provider}</td>
                    <td className="px-4 py-2">{row.eventType}</td>
                    <td className="px-4 py-2">
                      <Badge variant={WEBHOOK_STATUS_BADGE[row.status]} outline>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{row.signatureValid ? "Valid" : "Invalid"}</td>
                    <td className="px-4 py-2 text-neutral-500">{row.errorMessage ?? "—"}</td>
                    <td className="px-4 py-2 text-neutral-500">{formatDateTime(new Date(row.receivedAt))}</td>
                    <td className="px-4 py-2">
                      {row.status === "FAILED" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={retryingId === row.id}
                          onClick={() => handleRetryWebhook(row.id)}
                        >
                          Retry
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

      <div>
        <h2 className="text-label-lg text-neutral-900">Refunds</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-body-sm">
            <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
              <tr>
                <th className="px-4 py-2">Payment intent</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Reason</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {!refunds || refunds.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    {refunds === null ? "Loading…" : "No refunds yet."}
                  </td>
                </tr>
              ) : (
                refunds.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2 text-neutral-500">{row.paymentIntentId}</td>
                    <td className="px-4 py-2">{formatRupees(row.amountPaise)}</td>
                    <td className="px-4 py-2">
                      <Badge variant={REFUND_STATUS_BADGE[row.status]} outline>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{row.reason ?? "—"}</td>
                    <td className="px-4 py-2 text-neutral-500">{formatDateTime(new Date(row.createdAt))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
