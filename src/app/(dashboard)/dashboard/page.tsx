import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { Container } from "@/components/shared/container";
import { getDashboardData } from "@/lib/dashboard/get-dashboard-data";
import { getOrSetCache } from "@/lib/cache/cache";
import { HeroBanner } from "@/components/dashboard/hero-banner";
import { AmbientBackground } from "@/components/dashboard/ambient-background";
import { QuickActionsGrid } from "@/components/dashboard/quick-actions-grid";
import { ContinueEditingSection } from "@/components/dashboard/continue-editing-section";
import { RecentCreationsSection } from "@/components/dashboard/recent-creations-section";
import { TemplatesSection } from "@/components/dashboard/templates-section";
import { DashboardMetrics } from "@/components/dashboard/dashboard-metrics";
import { SectionHeader } from "@/components/dashboard/section-header";

// Milestone 3 — AI Operating System layout.
// 6 sections with 48px gaps, clear visual hierarchy, no clutter.
// Data fetch unchanged — same getDashboardData() call, same cache strategy.
// TrendingSection, InspirationSection, ComingSoon dropped per PRD priority list.
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const data = await getOrSetCache(
    `dashboard:${session.user.id}`,
    15,
    () => getDashboardData(session.user.id),
  );

  const { stats, continueWorking, tools, featuredTemplates } = data;
  const displayName = session.user.name || "there";

  const mainCards = tools.filter((t) => t.category === "MAIN_CARD");
  const mostRecent = continueWorking.all[0] ?? null;

  // Split by status: in-progress → Continue Editing, completed → Recent Creations
  const inProgressItems = continueWorking.all
    .filter((i) => i.status !== "COMPLETED")
    .slice(0, 6);
  const completedItems = continueWorking.all
    .filter((i) => i.status === "COMPLETED")
    .slice(0, 8);

  return (
    <div className="flex flex-col pb-20">
      <HeroBanner displayName={displayName} recentItem={mostRecent} />

      <div className="relative">
        <AmbientBackground />
        <Container className="relative flex flex-col gap-12 pt-12">
          {/* Quick Actions */}
          <section>
            <SectionHeader
              title="Create with AI"
              subtitle="Choose a tool to get started instantly"
            />
            <QuickActionsGrid tools={mainCards} />
          </section>

          {/* Continue Editing */}
          <ContinueEditingSection items={inProgressItems} />

          {/* Recent Creations */}
          <RecentCreationsSection items={completedItems} />

          {/* Templates */}
          <TemplatesSection templates={featuredTemplates} />

          {/* Workspace Metrics */}
          <DashboardMetrics stats={stats} />
        </Container>
      </div>
    </div>
  );
}
