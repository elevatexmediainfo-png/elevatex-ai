import { Badge, type BadgeVariant } from "@/components/ui/badge";

const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: "Generating", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "success" },
  FAILED: { label: "Failed", variant: "error" },
};

export function CreativeStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, variant: "neutral" as const };
  return (
    <Badge variant={meta.variant} dot pulse={status === "DRAFT"}>
      {meta.label}
    </Badge>
  );
}
