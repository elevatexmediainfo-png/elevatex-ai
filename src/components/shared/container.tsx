import * as React from "react";

import { cn } from "@/lib/utils";

// Section 12.4 — content max-width 1440px, responsive screen-edge padding
// (16px mobile / 24px tablet / 48px desktop).
//
// `as` lets a page-level Container render as the page's <main> landmark
// instead of a bare <div> — needed wherever Container is the outermost
// content wrapper for a route (e.g. (auth)/login) and nothing else already
// provides one. Without a <main> somewhere, screen reader users have no way
// to skip straight to page content.
export function Container({
  className,
  as: Comp = "div",
  ...props
}: React.ComponentProps<"div"> & { as?: "div" | "main" }) {
  return (
    <Comp
      className={cn(
        "mx-auto w-full max-w-[1440px] px-4 md:px-6 lg:px-12",
        className
      )}
      {...props}
    />
  );
}
