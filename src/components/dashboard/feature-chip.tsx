import type { LucideIcon } from "lucide-react";

export function FeatureChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-label-sm text-white backdrop-blur-sm">
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}
