import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { ensureInstalled } from "@/lib/installation";

// Without this, Next prerenders this layout statically at build time —
// ensureInstalled()'s redirect() fires before any recognized "dynamic API"
// (cookies/headers) is touched, so Next sees a clean redirect and bakes it
// into the static HTML forever, regardless of the real install state at
// request time. This must be re-evaluated on every request.
export const dynamic = "force-dynamic";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureInstalled();

  return (
    // bg-white is deliberate, not cosmetic — every marketing component uses
    // PRD 12.2's static/theme-independent tokens (text-neutral-500,
    // text-brand-navy, etc.), calibrated for a light background. The root
    // layout's body still applies the theme-responsive bg-background
    // (so a visitor's OS dark-mode preference correctly darkens the
    // dashboard), which would otherwise show through here and drop several
    // of these static text colors below WCAG AA contrast (caught by a
    // Lighthouse accessibility pass — see PROJECT_STATUS.md Milestone 12).
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
