import { Badge, type BadgeVariant } from "@/components/ui/badge";

const STATUS_META: Record<string, { label: string; variant: BadgeVariant; pulse?: boolean }> = {
  DRAFT: { label: "Draft", variant: "neutral" },
  SCRIPT_READY: { label: "Script Ready", variant: "info" },
  QUEUED: { label: "Queued", variant: "warning", pulse: true },
  RENDERING: { label: "Rendering", variant: "warning", pulse: true },
  PAUSED: { label: "Paused", variant: "neutral" },
  COMPLETED: { label: "Completed", variant: "success" },
  FAILED: { label: "Failed", variant: "error" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },
};

export function VideoStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, variant: "neutral" as const };
  return (
    <Badge variant={meta.variant} dot pulse={meta.pulse}>
      {meta.label}
    </Badge>
  );
}
