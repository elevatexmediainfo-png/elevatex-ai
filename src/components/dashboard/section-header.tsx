import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel = "View all",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-6 flex items-start justify-between gap-4", className)}>
      <div>
        <h2 className="text-[18px] font-semibold tracking-[-0.3px] text-dash-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-[13px] text-dash-ink/45">{subtitle}</p>}
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-dash-ink/40 transition-colors duration-150 hover:text-dash-ink/70"
        >
          {viewAllLabel}
          <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
