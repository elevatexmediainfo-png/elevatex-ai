import { prisma } from "@/lib/prisma";

export interface DailyActivity {
  date: string;
  count: number;
}

// Real per-day generation counts for the Usage Overview sparkline — not a
// fabricated chart. Buckets a flat list of timestamps into the last `days`
// calendar days (UTC), always returning one entry per day (zero-filled) so
// the chart never has gaps.
export function bucketDailyActivity(timestamps: Date[], days = 7, now: Date = new Date()): DailyActivity[] {
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const ts of timestamps) {
    const key = ts.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}

export async function getRecentActivity(userId: string, days = 7): Promise<DailyActivity[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  since.setUTCHours(0, 0, 0, 0);
  const logs = await prisma.generationLog.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { createdAt: true },
  });
  return bucketDailyActivity(
    logs.map((l) => l.createdAt),
    days
  );
}
