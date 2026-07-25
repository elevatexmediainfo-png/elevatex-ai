import * as React from "react";

import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  tone = "onLight",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  /** "onDark" for sections with a dark (e.g. bg-brand-navy) background —
   * the default eyebrow colour is calibrated for white/near-white
   * backgrounds and is nearly invisible on a dark one. */
  tone?: "onLight" | "onDark";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className
      )}
    >
      {eyebrow && (
        // Small text needs the full 4.5:1 ratio (no large-text exemption).
        // On light backgrounds, accent-orange measures ~2.9:1 and even
        // accent-orange-dark only reaches ~3.2:1 — neither clears the bar at
        // this size, so "onLight" uses a deeper shade instead (~5.2:1). That
        // same dark shade would be ~2.1:1 on a dark background, so "onDark"
        // uses accent-orange-light instead (~10:1 against brand-navy).
        <span
          className={cn(
            "text-label-sm uppercase tracking-wider",
            tone === "onDark" ? "text-accent-orange-light" : "text-[#c2410c]"
          )}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className={cn(
          "text-display-2 text-neutral-900",
          align === "center" && "max-w-2xl"
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "text-body-lg text-neutral-500",
            align === "center" && "max-w-xl"
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
