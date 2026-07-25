import { prisma } from "@/lib/prisma";
import type { BusinessVertical, VideoObjective } from "@/generated/prisma/enums";

// Dashboard redesign — real usage signals for the "Trending" section, not
// fabricated numbers. Two facets have a genuine countable signal today
// (Template.vertical usage, VideoProject.objective usage); "creative
// styles" has no equivalent anywhere in the schema and is deliberately not
// represented here rather than inventing one.

export interface TrendingIndustry {
  vertical: BusinessVertical;
  count: number;
}

export interface TrendingObjective {
  objective: VideoObjective;
  count: number;
}

// Pure reduction, kept separate from the Prisma call so it's unit-testable
// without a DB (this codebase's established convention: DB-bound functions
// are verified live, their pure logic gets a vitest suite). Template
// doesn't carry a usage counter column — real popularity is the count of
// VideoProjects actually created from templates of that vertical, summed
// across every template sharing it (a vertical, not a single template, is
// what the Dashboard surfaces as "trending"). Zero-count verticals are
// dropped rather than shown as a hollow "0 created" tile.
export function summarizeIndustryUsage(
  templates: { vertical: BusinessVertical; _count: { videoProjects: number } }[],
  limit = 5
): TrendingIndustry[] {
  const totals = new Map<BusinessVertical, number>();
  for (const t of templates) {
    totals.set(t.vertical, (totals.get(t.vertical) ?? 0) + t._count.videoProjects);
  }

  return Array.from(totals.entries())
    .map(([vertical, count]) => ({ vertical, count }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getTrendingIndustries(limit = 5): Promise<TrendingIndustry[]> {
  const templates = await prisma.template.findMany({
    where: { isActive: true },
    select: { vertical: true, _count: { select: { videoProjects: true } } },
  });
  return summarizeIndustryUsage(templates, limit);
}

// `objective` is a required field on every VideoProject (template-based or
// not), so this is a direct, complete platform-wide aggregate — no join,
// no gaps.
export async function getTrendingObjectives(limit = 5): Promise<TrendingObjective[]> {
  const rows = await prisma.videoProject.groupBy({
    by: ["objective"],
    _count: { _all: true },
    orderBy: { _count: { objective: "desc" } },
    take: limit,
  });

  return rows.filter((r) => r._count._all > 0).map((r) => ({ objective: r.objective, count: r._count._all }));
}
