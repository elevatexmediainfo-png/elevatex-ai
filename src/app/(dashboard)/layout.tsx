import { DashboardTopbar } from "@/components/shared/dashboard-topbar";
import { DashboardSidebar } from "@/components/shared/dashboard-sidebar";
import { MobileBottomNav } from "@/components/shared/mobile-bottom-nav";
import { NoiseOverlay } from "@/components/shared/noise-overlay";
import { ensureInstalled } from "@/lib/installation";

// force-dynamic: see (marketing)/layout.tsx's comment — without it, Next
// bakes ensureInstalled()'s redirect into a static build artifact.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureInstalled();

  return (
    <div
      className="relative flex flex-col min-h-screen overflow-x-clip"
    >
      <NoiseOverlay />

      {/* Premium topbar */}
      <DashboardTopbar />

      {/* Body: sidebar + content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Self-contained sidebar — handles own width animation + hidden/sm breakpoint */}
        <DashboardSidebar />

        {/* Main content — pb-16 on mobile to clear fixed bottom nav */}
        <main className="flex-1 min-w-0 overflow-y-auto pb-16 sm:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav — fixed, shown only below sm */}
      <MobileBottomNav />
    </div>
  );
}
