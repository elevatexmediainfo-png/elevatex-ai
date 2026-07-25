import * as React from "react";

import { cn } from "@/lib/utils";

// PRD Section 13.2 — Badge / Status Chip.
// variant: semantic colour. size: sm | md. dot: coloured-dot mode. outline: outlined mode.

export type BadgeVariant =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "neutral"
  | "brand";

const COLOR_MAP: Record<
  BadgeVariant,
  { filled: string; outline: string; dot: string }
> = {
  success: {
    filled: "bg-success-light text-success",
    outline: "border-success text-success",
    dot: "bg-success",
  },
  error: {
    filled: "bg-error-light text-error",
    outline: "border-error text-error",
    dot: "bg-error",
  },
  warning: {
    filled: "bg-warning-light text-warning",
    outline: "border-warning text-warning",
    dot: "bg-warning",
  },
  info: {
    filled: "bg-info-light text-info",
    outline: "border-info text-info",
    dot: "bg-info",
  },
  neutral: {
    filled: "bg-neutral-100 text-neutral-700",
    outline: "border-neutral-300 text-neutral-700",
    dot: "bg-neutral-400",
  },
  brand: {
    filled: "bg-brand-navy-light text-brand-navy",
    outline: "border-brand-navy text-brand-navy",
    dot: "bg-brand-navy",
  },
};

function Badge({
  className,
  variant = "neutral",
  size = "md",
  icon,
  dot = false,
  outline = false,
  pulse = false,
  children,
  ...props
}: React.ComponentProps<"span"> & {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  icon?: React.ReactNode;
  dot?: boolean;
  outline?: boolean;
  /** Animated pulsing dot — used for the "Processing" status badge. */
  pulse?: boolean;
}) {
  const colors = COLOR_MAP[variant];

  return (
    <span
      data-slot="badge"
      data-variant={variant}
      role="status"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xs font-medium",
        size === "sm" ? "h-5 px-1.5 text-label-sm" : "h-6 px-2 text-label-sm",
        outline
          ? cn("border bg-transparent", colors.outline)
          : dot
            ? "bg-transparent text-neutral-700"
            : colors.filled,
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            colors.dot,
            pulse && "animate-pulse-dot"
          )}
        />
      )}
      {!dot && icon}
      {children}
    </span>
  );
}

export { Badge };
