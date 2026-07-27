import type { ProviderCategory } from "@/generated/prisma/client";
import { listProviderConfigs } from "@/lib/admin/ai-providers";
import { getConfig } from "@/lib/admin/config";

// Milestone 13 — read-only "is this installation production-ready"
// checklist (brief item 9, Installation Independence). Every signal here is
// already-existing state (ProviderConfig rows, CONFIG_REGISTRY values, the
// MSG91 env var the OTP route already gates on) — this adds zero new
// settings of its own, it just summarizes what's already configurable
// from the Admin Panel so a founder doesn't have to check 8 pages by hand.

export type InstallationItemStatus = "OK" | "WARNING" | "ACTION_NEEDED";

export interface InstallationChecklistItem {
  key: string;
  label: string;
  status: InstallationItemStatus;
  detail: string;
}

export interface InstallationChecklist {
  items: InstallationChecklistItem[];
  actionNeededCount: number;
  readyForProduction: boolean;
}

// Milestone 26 — deliberately Partial, not a full Record<ProviderCategory,
// string>: STOCK_MEDIA/ICON are supplementary (the Creative Studio Sidebar
// isn't wired to consume them yet, see lib/providers/stock-media/) and
// should NOT block "ready for production" the way a missing core
// generation/storage/payment provider does.
const CATEGORY_LABELS: Partial<Record<ProviderCategory, string>> = {
  LLM: "Script generation (LLM)",
  IMAGE: "Image generation",
  VOICE: "Voice generation",
  VIDEO: "Video generation",
  TRANSCRIPTION: "Transcription",
  STORAGE: "Storage",
  PAYMENT: "Payments",
  EMAIL: "Email",
};

export async function getInstallationChecklist(): Promise<InstallationChecklist> {
  const configs = await listProviderConfigs();
  const items: InstallationChecklistItem[] = [];

  const categories = Object.keys(CATEGORY_LABELS) as ProviderCategory[];
  for (const category of categories) {
    const rows = configs.filter((c) => c.category === category);
    const active = rows.find((r) => r.enabled);
    if (!active) {
      // STORAGE and PAYMENT hard-refuse in production instead of falling
      // back to Mock (lib/providers/storage/index.ts, lib/providers/
      // payment/index.ts — both 2026-07-23 security fixes: a silent Mock
      // fallback for either was a real data-loss/free-checkout exploit
      // risk). The generic "falling back to the mock provider" wording
      // below was factually wrong for these two specifically — confirmed
      // live, a real upload attempt in production threw
      // StorageProviderUnavailableError, not a silent Mock write — which
      // understated the real, immediate consequence of leaving either
      // unconfigured.
      const hardRefusesInProduction = category === "STORAGE" || category === "PAYMENT";
      items.push({
        key: `provider:${category}`,
        label: CATEGORY_LABELS[category] ?? category,
        status: "ACTION_NEEDED",
        detail: hardRefusesInProduction
          ? "No provider enabled — every request will fail outright in production (no mock fallback, by design). Enable a real one in AI Providers before going live."
          : "No provider enabled — falling back to the mock provider. Enable a real one in AI Providers before going live.",
      });
    } else if (!active.hasApiKey) {
      items.push({
        key: `provider:${category}`,
        label: CATEGORY_LABELS[category] ?? category,
        status: "ACTION_NEEDED",
        detail: `"${active.label}" is enabled but has no API key saved.`,
      });
    } else {
      items.push({
        key: `provider:${category}`,
        label: CATEGORY_LABELS[category] ?? category,
        status: "OK",
        detail: `Using "${active.label}".`,
      });
    }
  }

  const otpConfigured = !!process.env.MSG91_AUTH_KEY;
  const isProduction = process.env.NODE_ENV === "production";
  items.push({
    key: "otp_login",
    label: "OTP login (MSG91)",
    status: otpConfigured ? "OK" : isProduction ? "ACTION_NEEDED" : "WARNING",
    detail: otpConfigured
      ? "MSG91_AUTH_KEY is set — real OTPs will be sent."
      : isProduction
        ? "MSG91_AUTH_KEY is missing in production — OTP login will not work."
        : "MSG91_AUTH_KEY is not set. Fine for local development (dev OTP fallback is active); set it before deploying to production.",
  });

  const taxDetails = await getConfig("BUSINESS_TAX_DETAILS");
  items.push({
    key: "business_tax_details",
    label: "Invoice business details",
    status: taxDetails.legalName && taxDetails.gstin ? "OK" : "WARNING",
    detail:
      taxDetails.legalName && taxDetails.gstin
        ? "Business name and GSTIN are set — invoices will print them."
        : "Business legal name/GSTIN are blank — invoices will still generate, but without tax details. Set these in Pricing & Credits.",
  });

  const actionNeededCount = items.filter((i) => i.status === "ACTION_NEEDED").length;

  return {
    items,
    actionNeededCount,
    readyForProduction: actionNeededCount === 0,
  };
}
