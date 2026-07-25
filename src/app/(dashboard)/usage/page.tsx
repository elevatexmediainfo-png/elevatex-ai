import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";

import { auth } from "@/lib/auth";
import { Container } from "@/components/shared/container";
import { Badge } from "@/components/ui/badge";
import { getUserUsageSummary } from "@/lib/usage/dashboard";

const SOURCE_LABEL: Record<string, string> = {
  GENERATED: "Brief → Script",
  TALKING_HEAD_UPLOAD: "Talking Head",
};

const CREDIT_TYPE_LABEL: Record<string, string> = {
  DOWNLOAD: "Downloads",
  AI_GENERATION: "AI generation",
  EXPORT: "Exports",
};

export default async function UsagePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usage = await getUserUsageSummary(session.user.id);
  const totalProjects = usage.projectsBySourceType.reduce((sum, r) => sum + r.count, 0);

  return (
    <Container className="flex max-w-2xl flex-col gap-8 py-10">
      <div>
        <h1 className="text-heading-1 text-dash-ink">Usage</h1>
        <p className="mt-1 text-body-md text-dash-ink/55">
          Your activity across projects, exports, downloads, and credits.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-card border border-edge-card bg-glass-card p-4 backdrop-blur-xl">
          <p className="text-display-2 text-dash-ink">{totalProjects}</p>
          <p className="text-body-sm text-dash-ink/55">Projects</p>
        </div>
        <div className="rounded-card border border-edge-card bg-glass-card p-4 backdrop-blur-xl">
          <p className="text-display-2 text-dash-ink">{usage.exportsCount}</p>
          <p className="text-body-sm text-dash-ink/55">Exports</p>
        </div>
        <div className="rounded-card border border-edge-card bg-glass-card p-4 backdrop-blur-xl">
          <p className="text-display-2 text-dash-ink">{usage.downloadsCount}</p>
          <p className="text-body-sm text-dash-ink/55">Downloads</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-label-lg text-dash-ink">Projects by type</h2>
        {usage.projectsBySourceType.length === 0 ? (
          <p className="py-4 text-center text-body-sm text-dash-ink/55">No projects yet.</p>
        ) : (
          usage.projectsBySourceType.map((row) => (
            <div
              key={row.sourceType}
              className="flex items-center justify-between rounded-lg border border-edge-card bg-glass-card px-4 py-3"
            >
              <p className="text-label-md text-dash-ink">{SOURCE_LABEL[row.sourceType] ?? row.sourceType}</p>
              <Badge variant="neutral" outline>
                {row.count}
              </Badge>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-label-lg text-dash-ink">Projects by status</h2>
        {usage.projectsByStatus.map((row) => (
          <div
            key={row.status}
            className="flex items-center justify-between rounded-lg border border-edge-card bg-glass-card px-4 py-3"
          >
            <p className="text-label-md text-dash-ink">{row.status}</p>
            <Badge variant="neutral" outline>
              {row.count}
            </Badge>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-dash-ink/55" />
          <h2 className="text-label-lg text-dash-ink">Credits consumed (last 30 days)</h2>
        </div>
        <div className="rounded-card border border-edge-card bg-glass-card p-4 backdrop-blur-xl">
          <p className="text-display-2 text-dash-ink">{usage.creditsConsumed30d}</p>
          <p className="text-body-sm text-dash-ink/55">Total credits spent</p>
        </div>
        {usage.creditsConsumedByType.map((row) => (
          <div
            key={row.type}
            className="flex items-center justify-between rounded-lg border border-edge-card bg-glass-card px-4 py-3"
          >
            <p className="text-label-md text-dash-ink">{CREDIT_TYPE_LABEL[row.type] ?? row.type}</p>
            <Badge variant="neutral" outline>
              {row.amount}
            </Badge>
          </div>
        ))}
      </div>
    </Container>
  );
}
