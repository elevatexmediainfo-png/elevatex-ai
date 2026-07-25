import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { getHealthDashboard } from "@/lib/admin/health-dashboard";
import { getAbuseReport } from "@/lib/admin/abuse-detection";
import { getDeadLetterJobs } from "@/lib/render/analytics";
import { getCostManagementReport } from "@/lib/admin/cost-management";
import { getStorageUsageSummary } from "@/lib/admin/storage-monitor";
import { getInstallationChecklist, type InstallationChecklist } from "@/lib/admin/installation-status";

// Milestone 13 — Founder Command Center. Pure composition of signals that
// already exist (getHealthDashboard, getAbuseReport, getDeadLetterJobs,
// the new Phase C webhook log and Phase D payments data) plus founder-set
// thresholds (Phase H's three new config keys) — no new tracking table.
//
// "One-click actions" here are direct links to the exact admin page/tab
// that already has the real fix (Retry on Payments/Render, rotate key on
// AI Providers) rather than a new blind auto-remediation button — most of
// these issues (a real outage, a spend spike) need a founder's judgment,
// not a guess baked into this dashboard.

export type AlertStatus = "OK" | "ALERT";

export interface CommandCenterAlert {
  key: string;
  label: string;
  status: AlertStatus;
  detail: string;
  actionHref: string;
}

export interface CommandCenterReport {
  alerts: CommandCenterAlert[];
  alertCount: number;
  installation: InstallationChecklist;
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getCommandCenterReport(): Promise<CommandCenterReport> {
  const todayStart = startOfTodayUTC();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    health,
    abuseFlags,
    deadLetterJobs,
    costToday,
    storage,
    installation,
    webhookFailures24h,
    paymentFailures24h,
    subscriptionsCancelled24h,
    subscriptionsActivated24h,
    dailyApiCostAlertUsd,
    storageBudgetGb,
    lowCreditThreshold,
  ] = await Promise.all([
    getHealthDashboard(),
    getAbuseReport(),
    getDeadLetterJobs(50),
    getCostManagementReport(todayStart),
    getStorageUsageSummary(),
    getInstallationChecklist(),
    prisma.webhookEvent.count({ where: { status: "FAILED", receivedAt: { gte: since24h } } }),
    prisma.paymentIntent.count({ where: { status: "FAILED", createdAt: { gte: since24h } } }),
    prisma.subscription.count({ where: { status: { in: ["CANCELLED", "EXPIRED"] }, updatedAt: { gte: since24h } } }),
    prisma.subscription.count({ where: { createdAt: { gte: since24h } } }),
    getConfig("DAILY_API_COST_ALERT_USD"),
    getConfig("STORAGE_BUDGET_GB"),
    getConfig("LOW_CREDIT_BALANCE_ALERT_THRESHOLD"),
  ]);

  const lowCreditUserCount =
    lowCreditThreshold > 0 ? await prisma.creditAccount.count({ where: { balance: { lt: lowCreditThreshold } } }) : 0;

  const downProviders = health.providers.filter((p) => p.status === "DOWN");

  const alerts: CommandCenterAlert[] = [
    {
      key: "providers_down",
      label: "Provider down",
      status: downProviders.length > 0 ? "ALERT" : "OK",
      detail:
        downProviders.length > 0
          ? `${downProviders.length} provider(s) currently DOWN: ${downProviders.map((p) => `${p.category}/${p.providerId}`).join(", ")}.`
          : "All providers healthy.",
      actionHref: "/admin/health",
    },
    {
      key: "failed_queue",
      label: "Failed render jobs",
      status: deadLetterJobs.length > 0 ? "ALERT" : "OK",
      detail:
        deadLetterJobs.length > 0
          ? `${deadLetterJobs.length} job(s) in the dead-letter list.`
          : "No failed render jobs awaiting retry.",
      actionHref: "/admin/render",
    },
    {
      key: "webhook_failures",
      label: "Webhook failures (24h)",
      status: webhookFailures24h > 0 ? "ALERT" : "OK",
      detail:
        webhookFailures24h > 0
          ? `${webhookFailures24h} webhook event(s) failed to process in the last 24h.`
          : "No failed webhook events in the last 24h.",
      actionHref: "/admin/payments",
    },
    {
      key: "payment_failures",
      label: "Payment failures (24h)",
      status: paymentFailures24h > 0 ? "ALERT" : "OK",
      detail:
        paymentFailures24h > 0
          ? `${paymentFailures24h} payment(s) failed in the last 24h.`
          : "No failed payments in the last 24h.",
      actionHref: "/admin/payments",
    },
    {
      key: "subscription_drop",
      label: "Subscription drop (24h)",
      status: subscriptionsCancelled24h > subscriptionsActivated24h ? "ALERT" : "OK",
      detail: `${subscriptionsCancelled24h} cancelled/expired vs ${subscriptionsActivated24h} new in the last 24h.`,
      actionHref: "/admin/subscriptions",
    },
    {
      key: "high_api_cost",
      label: "High API cost (today)",
      status: dailyApiCostAlertUsd > 0 && costToday.totals.costUsd > dailyApiCostAlertUsd ? "ALERT" : "OK",
      detail:
        dailyApiCostAlertUsd > 0
          ? `Today's AI vendor spend: $${costToday.totals.costUsd.toFixed(2)} (threshold $${dailyApiCostAlertUsd.toFixed(2)}).`
          : `Today's AI vendor spend: $${costToday.totals.costUsd.toFixed(2)}. Set a threshold below to enable this alert.`,
      actionHref: "/admin/cost-management",
    },
    {
      key: "storage_almost_full",
      label: "Storage almost full",
      status:
        storageBudgetGb > 0 && storage.totalKnownBytes > storageBudgetGb * 1_000_000_000 * 0.9 ? "ALERT" : "OK",
      detail:
        storageBudgetGb > 0
          ? `${(storage.totalKnownBytes / 1_000_000_000).toFixed(1)} GB known usage of a ${storageBudgetGb} GB budget.`
          : `${(storage.totalKnownBytes / 1_000_000_000).toFixed(1)} GB known usage. Set a budget below to enable this alert.`,
      actionHref: "/admin/storage",
    },
    {
      key: "credits_running_low",
      label: "Credits running low",
      status: lowCreditThreshold > 0 && lowCreditUserCount > 0 ? "ALERT" : "OK",
      detail:
        lowCreditThreshold > 0
          ? `${lowCreditUserCount} user(s) below the ${lowCreditThreshold}-credit threshold.`
          : "Set a threshold below to enable this alert.",
      actionHref: "/admin/pricing",
    },
    {
      key: "abuse_flags",
      label: "Abuse flags",
      status: abuseFlags.length > 0 ? "ALERT" : "OK",
      detail: abuseFlags.length > 0 ? `${abuseFlags.length} account(s) flagged for review.` : "No accounts currently flagged.",
      actionHref: "/admin/abuse",
    },
  ];

  return {
    alerts,
    alertCount: alerts.filter((a) => a.status === "ALERT").length,
    installation,
  };
}
