import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";

import { auth } from "@/lib/auth";
import { Container } from "@/components/shared/container";
import { Badge } from "@/components/ui/badge";
import { getCreditBalance, listCreditTransactions, listCreditLots } from "@/lib/credits/engine";
import { getReferralStats } from "@/lib/referrals/engine";
import { listInvoicesForUser } from "@/lib/billing/invoices";
import { getBillingHistory } from "@/lib/billing/history";
import { formatDate, formatDateTime } from "@/lib/format";
import { BillingActions } from "./billing-actions";
import { ReferralPanel } from "./referral-panel";
import { InvoiceList } from "./invoice-list";

const TYPE_LABEL: Record<string, string> = {
  SIGNUP_BONUS: "Signup bonus",
  PURCHASE: "Purchase",
  SUBSCRIPTION_GRANT: "Subscription credit",
  PROMOTIONAL: "Promotional credit",
  REFERRAL: "Referral credit",
  DOWNLOAD: "Download",
  REFUND: "Refund",
  EXPIRY: "Expired",
  ADMIN_ADJUSTMENT: "Adjustment",
};

const LOT_TYPE_LABEL: Record<string, string> = {
  SIGNUP_BONUS: "Signup bonus",
  PURCHASED: "Purchased",
  SUBSCRIPTION: "Subscription",
  PROMOTIONAL: "Promotional",
  REFERRAL: "Referral",
  ADMIN_ADJUSTMENT: "Adjustment",
};

export default async function CreditsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [balance, transactions, lots, referralStats, invoices, billingHistory] = await Promise.all([
    getCreditBalance(session.user.id),
    listCreditTransactions(session.user.id, 50),
    listCreditLots(session.user.id),
    getReferralStats(session.user.id),
    listInvoicesForUser(session.user.id),
    getBillingHistory(session.user.id),
  ]);

  return (
    <Container className="flex max-w-2xl flex-col gap-8 py-10">
      <div>
        <h1 className="text-heading-1 text-dash-ink">Credits</h1>
        <p className="mt-1 text-body-md text-dash-ink/55">
          Every credit movement on your account, newest first.
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-card border border-edge-card bg-glass-card p-5 backdrop-blur-xl">
        <span className="flex size-11 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400">
          <Wallet className="size-5" />
        </span>
        <div>
          <p className="text-display-2 text-dash-ink">{balance}</p>
          <p className="text-body-sm text-dash-ink/55">Credits remaining</p>
        </div>
      </div>

      <BillingActions />

      <ReferralPanel referralCode={referralStats.referralCode} referralCount={referralStats.referralCount} />

      {lots.length > 0 && (
        <div>
          <h2 className="text-label-lg text-dash-ink">Credit lots</h2>
          <p className="mt-1 text-body-sm text-dash-ink/55">
            Free, purchased, subscription, promotional, and referral credits each have their own
            expiry — this is what the Credit Engine draws down when you pay for a download.
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {lots.map((lot) => (
              <div
                key={lot.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-edge-card bg-glass-card px-4 py-3"
              >
                <div>
                  <p className="text-label-md text-dash-ink">
                    {LOT_TYPE_LABEL[lot.type] ?? lot.type}
                  </p>
                  <p className="text-body-sm text-dash-ink/55">
                    {lot.expiresAt ? `Expires ${formatDate(lot.expiresAt)}` : "Never expires"}
                  </p>
                </div>
                <Badge variant="neutral" outline>
                  {lot.remaining} / {lot.amount}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <InvoiceList
        invoices={invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          totalPaise: inv.totalPaise,
          createdAt: inv.createdAt.toISOString(),
        }))}
      />

      {billingHistory.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-label-lg text-dash-ink">Billing history</h2>
          {billingHistory.map((entry) => (
            <div
              key={`${entry.kind}-${entry.id}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-edge-card bg-glass-card px-4 py-3"
            >
              <div>
                <p className="text-label-md text-dash-ink">
                  {entry.kind === "PAYMENT" ? entry.description : `Download (${entry.method})`}
                </p>
                <p className="mt-0.5 text-body-sm text-dash-ink/55">{formatDateTime(entry.createdAt)}</p>
              </div>
              <Badge variant={entry.kind === "PAYMENT" && entry.status === "PAID" ? "success" : "neutral"} outline>
                {entry.kind === "PAYMENT"
                  ? `₹${(entry.amountPaise / 100).toFixed(0)} · ${entry.status}`
                  : entry.amountPaidPaise
                    ? `₹${(entry.amountPaidPaise / 100).toFixed(0)}`
                    : `${entry.creditsSpent} credits`}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-label-lg text-dash-ink">Activity</h2>
        {transactions.length === 0 ? (
          <p className="py-8 text-center text-body-md text-dash-ink/55">No credit activity yet.</p>
        ) : (
          transactions.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-edge-card bg-glass-card px-4 py-3"
            >
              <div>
                <p className="text-label-md text-dash-ink">
                  {t.description || TYPE_LABEL[t.type] || t.type}
                </p>
                <p className="mt-0.5 text-body-sm text-dash-ink/55">{formatDateTime(t.createdAt)}</p>
              </div>
              <Badge variant={t.amount >= 0 ? "success" : "neutral"} outline>
                {t.amount >= 0 ? "+" : ""}
                {t.amount}
              </Badge>
            </div>
          ))
        )}
      </div>
    </Container>
  );
}
