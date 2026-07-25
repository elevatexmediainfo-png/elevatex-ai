import type { LucideIcon } from "lucide-react";

import { MotionPrimaryButton } from "../../motion-primitives";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <Icon className="size-8 text-neutral-600" />
      <p className="text-label-sm text-neutral-300">{title}</p>
      <p className="text-caption text-neutral-500">{description}</p>
      {actionLabel && (
        // pointer-events-auto is a no-op everywhere EmptyState already sits
        // in the normal (pointer-events: auto) flow — it only matters for
        // the Timeline's empty state, which layers this over the track
        // lanes inside a pointer-events-none wrapper (so the icon/text
        // don't block dropping a clip) and needs just the button itself to
        // stay clickable.
        <MotionPrimaryButton type="button" className="pointer-events-auto mt-2 w-auto" onClick={onAction}>
          {actionLabel}
        </MotionPrimaryButton>
      )}
    </div>
  );
}
