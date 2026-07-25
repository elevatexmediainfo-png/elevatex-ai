import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, Star } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/shared/container";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const VERTICALS = [
  "RESTAURANT",
  "CAFE_BAKERY",
  "SALON_SPA",
  "DENTAL_DIAGNOSTIC",
  "REAL_ESTATE",
  "RETAIL",
  "GYM_FITNESS",
  "HOSPITAL",
  "COACHING_EDTECH",
  "HOTEL",
  "FINANCE",
  "OTHER",
] as const;

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ vertical?: string; objective?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { vertical, objective } = await searchParams;

  const templates = await prisma.template.findMany({
    where: {
      isActive: true,
      // Festival Greeting removed from user-facing surfaces 2026-07-11
      // (founder decision) — unconditional, not just the default view, so
      // a manually-typed ?objective=FESTIVAL_GREETING can't surface it
      // either (an AND clause, not a spread key that a later
      // ?objective= filter below could silently overwrite). The Template
      // row itself (and its objective-override resolution path in
      // resolveTemplateForProject()) is untouched. `defaultObjective` is
      // nullable and every OTHER template has it unset — `not: "..."`
      // alone excludes those NULL rows too under standard SQL three-valued
      // logic, so NULL must be explicitly allowed back in.
      AND: [
        { OR: [{ defaultObjective: null }, { defaultObjective: { not: "FESTIVAL_GREETING" } }] },
        ...(vertical ? [{ vertical: vertical as never }] : []),
        ...(objective ? [{ defaultObjective: objective as never }] : []),
      ],
    },
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
  });

  return (
    <Container className="flex flex-col gap-6 py-10">
      <div>
        <h1 className="text-heading-1 text-dash-ink">Templates</h1>
        <p className="mt-1 text-body-md text-dash-ink/55">Pre-built video templates, matched to your business.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/templates"
          className={cn(
            "rounded-full border px-3 py-1.5 text-label-sm transition-colors",
            !vertical
              ? "border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-300"
              : "border-edge-card text-dash-ink/65 hover:border-edge-hover"
          )}
        >
          All
        </Link>
        {VERTICALS.map((v) => (
          <Link
            key={v}
            href={`/templates?vertical=${v}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-label-sm transition-colors",
              vertical === v
                ? "border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-300"
                : "border-edge-card text-dash-ink/65 hover:border-edge-hover"
            )}
          >
            {formatLabel(v)}
          </Link>
        ))}
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-card bg-glass-card py-16 text-center backdrop-blur-xl">
          <Sparkles className="size-8 text-dash-ink/20" />
          <p className="text-body-md text-dash-ink/55">No templates in this category yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Link
              key={t.id}
              // The wizard no longer accepts templateId (the "pick a
              // template" step was removed — see
              // app/(dashboard)/create/video/page.tsx) — objective is the
              // one lever this gallery can still meaningfully pre-fill;
              // vertical is already resolved server-side from the user's
              // own Profile. Points at the AI Video wizard (this gallery is
              // always AI Video intent), not bare /create (now the 4-card
              // selector) — 4-option restructure Step 1. Repointed to
              // /create/video/script-ad (4-option restructure Step 3,
              // 2026-07-12) — a gallery template pre-fills the multi-scene
              // wizard's objective, not Quick Video's single-clip form,
              // which now owns the bare /create/video route.
              href={t.defaultObjective ? `/create/video/script-ad?objective=${t.defaultObjective}` : "/create/video/script-ad"}
              className="flex flex-col gap-2 rounded-card border border-edge-card bg-glass-card p-4 backdrop-blur-xl transition-colors hover:border-edge-hover"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-label-lg text-dash-ink">{t.name}</p>
                {t.isFeatured && (
                  <Badge variant="brand" outline icon={<Star className="size-3" />}>
                    Featured
                  </Badge>
                )}
              </div>
              {t.description && <p className="text-body-sm text-dash-ink/55">{t.description}</p>}
              <div className="mt-1 flex items-center gap-3 text-label-sm text-dash-ink/55">
                <span>{formatLabel(t.vertical)}</span>
                <span>·</span>
                <span>{t.durationSeconds}s</span>
                <span>·</span>
                <span>
                  {t.creditCost} credit{t.creditCost === 1 ? "" : "s"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
