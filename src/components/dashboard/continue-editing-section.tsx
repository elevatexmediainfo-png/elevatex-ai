import type { ContinueWorkingItem } from "@/lib/dashboard/continue-working";
import { SectionHeader } from "./section-header";
import { PremiumProjectCard } from "./premium-project-card";

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

interface ContinueEditingSectionProps {
  items: ContinueWorkingItem[];
}

export function ContinueEditingSection({ items }: ContinueEditingSectionProps) {
  if (items.length === 0) return null;

  return (
    <section>
      <SectionHeader title="Continue editing" viewAllHref="/projects" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <PremiumProjectCard
            key={item.id}
            title={item.title}
            thumbnailUrl={item.thumbnailUrl}
            status={item.status}
            kind={item.kind}
            href={item.href}
            updatedAtLabel={formatRelative(item.updatedAt)}
          />
        ))}
      </div>
    </section>
  );
}
