import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, TriangleAlert } from "lucide-react";

import { auth } from "@/lib/auth";
import { Container } from "@/components/shared/container";
import { ensureInstalled } from "@/lib/installation";
import { listExpiringProviderKeys } from "@/lib/admin/ai-providers";
import { formatDateTime } from "@/lib/format";
import { getInstallationChecklist } from "@/lib/admin/installation-status";

// force-dynamic: see (marketing)/layout.tsx's comment — without it, Next
// bakes ensureInstalled()'s redirect into a static build artifact.
export const dynamic = "force-dynamic";

const ADMIN_NAV_ITEMS = [
  { href: "/admin/founder", label: "Founder Dashboard" },
  { href: "/admin/command-center", label: "Command Center" },
  { href: "/admin/health", label: "Health" },
  { href: "/admin/ai-providers", label: "AI Providers" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/revenue", label: "Revenue" },
  { href: "/admin/cost-management", label: "Cost Management" },
  { href: "/admin/generation", label: "Generation Engine" },
  { href: "/admin/creative-director", label: "Creative Director" },
  { href: "/admin/creative-brain-inspector", label: "Brain Inspector" },
  { href: "/admin/reference-library", label: "Reference Library" },
  { href: "/admin/asset-library", label: "Asset Library" },
  { href: "/admin/render", label: "Render Pipeline" },
  { href: "/admin/video-editor", label: "AI Video Editor" },
  { href: "/admin/storage", label: "Storage" },
  { href: "/admin/pricing", label: "Pricing & Credits" },
  { href: "/admin/credit-rates", label: "Credit Rates" },
  { href: "/admin/creative-tools", label: "Creative Tools" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/marketing-templates", label: "Marketing Templates" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/abuse", label: "Abuse" },
  { href: "/admin/rules", label: "Download & Credit Rules" },
];

// Real security boundary for /admin — middleware's role check
// (lib/auth/config.ts) is a fast-path redirect, this is the server-side
// guard every request to anything under /admin must pass.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureInstalled();

  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const expiringKeys = await listExpiringProviderKeys();
  const installationChecklist = await getInstallationChecklist();
  const actionNeededItems = installationChecklist.items.filter((i) => i.status === "ACTION_NEEDED");

  return (
    <div className="relative flex min-h-screen flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <Container className="flex h-16 items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-brand-navy text-white">
              <ShieldCheck className="size-4" />
            </span>
            <span className="text-heading-3 text-brand-navy">Elevatex AI Admin</span>
          </Link>
          <Link href="/dashboard" className="text-label-sm text-neutral-500 hover:text-neutral-900">
            Back to app
          </Link>
        </Container>
      </header>
      {/* 2026-07-23 — readyForProduction was already correctly computed by
          getInstallationChecklist() but was only ever visible to an admin
          who happened to open Command Center. This is the real, always-
          rendered enforcement point: every /admin/* page goes through this
          layout, so a regression (a real provider row getting disabled/
          deleted, PAYMENT/EMAIL/VOICE never configured) is now impossible
          to miss rather than something an admin has to remember to check.
          Deliberately full-width, above the header's own content and more
          severe (error, not warning) than the expiring-keys banner below —
          this is "real users can currently pay ₹0 or get fake content,"
          not "a key needs rotating soon." */}
      {!installationChecklist.readyForProduction && (
        <div className="border-b border-error/40 bg-error-light px-4 py-3">
          <Container className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-error" />
            <div className="text-body-sm text-error">
              <p className="font-semibold">
                Not production-ready — {actionNeededItems.length} item{actionNeededItems.length === 1 ? "" : "s"} need
                {actionNeededItems.length === 1 ? "s" : ""} action before real users should reach this app.
              </p>
              <ul className="mt-1 list-inside list-disc">
                {actionNeededItems.map((item) => (
                  <li key={item.key}>
                    <span className="font-medium">{item.label}:</span> {item.detail}
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </div>
      )}
      <Container className="flex flex-col gap-6 py-8">
        {expiringKeys.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-light px-4 py-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="text-body-sm text-neutral-700">
              {expiringKeys.map((k) => (
                <p key={`${k.category}:${k.providerId}`}>
                  <span className="font-medium">{k.label}</span>{" "}
                  {k.expired ? "key has expired" : `key expires ${formatDateTime(k.keyExpiresAt)}`} —{" "}
                  <Link href="/admin/ai-providers" className="underline">
                    rotate it in AI Providers
                  </Link>
                  .
                </p>
              ))}
            </div>
          </div>
        )}
        <nav className="flex gap-1 rounded-xl border border-neutral-200 bg-white p-1">
          {ADMIN_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 rounded-lg px-4 py-2 text-center text-label-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {children}
      </Container>
    </div>
  );
}
