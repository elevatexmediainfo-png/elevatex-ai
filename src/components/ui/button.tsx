import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

// PRD Section 12.7 — Button System.
// Anatomy: [leading icon?] [label: text-label-md] [trailing icon?]
// Press animation: scale 0.96 on press-down, spring back on release (60ms).

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-label-md transition-all duration-100 ease-[var(--ease-micro)] outline-none select-none active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:ring-3 focus-visible:ring-ring/40",
  {
    variants: {
      variant: {
        // ButtonPrimary — bg accent-orange, primary CTAs.
        // Text is neutral-900, not white: white-on-accent-orange measures
        // ~2.9:1 contrast (fails WCAG AA's 4.5:1) — neutral-900 on the same
        // background measures ~5:1. Background colour is unchanged from the
        // PRD design tokens; only the foreground pairing was fixed.
        primary:
          "bg-accent-orange text-neutral-900 hover:bg-accent-orange-dark hover:scale-[1.02]",
        // ButtonSecondary — bg brand-navy, secondary actions
        secondary:
          "bg-brand-navy text-white hover:bg-brand-navy-dark hover:scale-[1.02]",
        // ButtonOutline — transparent, brand-navy border, tertiary options
        outline:
          "border-[1.5px] border-brand-navy bg-transparent text-brand-navy hover:bg-brand-navy-light",
        // ButtonGhost — inline text actions, toolbar buttons
        ghost: "bg-transparent text-neutral-700 hover:bg-neutral-100",
        // ButtonDestructive — irreversible actions
        destructive: "bg-error text-white hover:bg-[#B91C1C]",
        // ButtonDestructiveOutline — confirmable destructive actions
        destructiveOutline:
          "border-[1.5px] border-error bg-transparent text-error hover:bg-error-light",
        // Chip variants — filter chips, tag chips, objective cards
        chip: "rounded-full border border-neutral-300 bg-neutral-100 text-neutral-700 hover:border-brand-navy hover:bg-brand-navy-light hover:text-brand-navy",
        chipActive:
          "rounded-full border-[1.5px] border-brand-navy bg-brand-navy-light text-brand-navy",
        link: "text-brand-navy underline-offset-4 hover:underline",
        // ButtonEditorPrimary (2026-07-13) — the Cloud Video Editor's one
        // gradient CTA style (Export, Upload media, Start Export), additive
        // only: a brand-new variant key other call sites never opt into, so
        // this can't regress the light-themed marketing/dashboard/admin
        // consumers of this same component. Gradient is derived from
        // --color-editor-accent (editor-scoped token, confirmed
        // editor-only in an earlier pass) — first stop is the literal
        // token, second stop is that same hue mixed ~30% toward black for
        // depth (computed by hand, not color-mix(), for reliable cross-
        // browser Tailwind arbitrary-value parsing). Sizing (14px radius,
        // 44px height) is baked into the variant itself rather than
        // composed with the `size` variant — pair with `size="none"` (see
        // below) so the two axes never both try to set height/padding.
        // Hover/press transform is owned by Framer Motion at the call site
        // (motion-primitives.tsx's MotionPrimaryButton), not CSS — the
        // base class's own `active:scale-[0.96]` is neutralized here so
        // the two animation systems never fight over the same transform.
        editorPrimary:
          "h-editor-button-height min-w-[120px] rounded-editor-button bg-[linear-gradient(180deg,var(--color-editor-accent)_0%,#4057af_100%)] px-5 text-white shadow-[0_2px_10px_-2px_rgba(91,124,250,0.55)] transition-[box-shadow] duration-200 hover:shadow-[0_0_22px_-2px_rgba(91,124,250,0.65)] active:scale-100",
      },
      size: {
        lg: "h-13 min-w-[160px] px-4 py-3.5 text-label-lg",
        default: "h-11 min-w-[120px] px-4 py-2.5",
        sm: "h-9 min-w-[80px] px-3 py-2 text-label-sm",
        chip: "h-9 px-3 text-label-sm",
        "icon-lg": "size-12",
        icon: "size-10",
        "icon-sm": "size-8",
        // Cloud Video Editor's TrackHeader (2026-07-15, UI consistency
        // pass) — icon-sm (32px) doesn't fit 6 icon buttons in the
        // 168px-wide TRACK_HEADER_WIDTH column alongside its left-side
        // grip/dot/kind-icon cluster. Real math, not a guess: column
        // content width after px-2 padding = 168 - 16 = 152px; left cluster
        // (grip 12 + gap 4 + dot 6 + gap 6 + kind-icon 14) = 42px; a
        // minimum 4px gap to the right cluster leaves 152 - 42 - 4 = 106px
        // for up to 6 buttons + 5 gap-0.5 (2px) gaps between them: 6N + 10
        // <= 106 → N <= 16px. Set to size-3.5 (14px) rather than the exact
        // 16px ceiling — matches the bare icons' own current on-screen size
        // exactly (TrackHeader's icons already render at size-3.5), so this
        // is a drop-in visual no-op (6*14 + 5*2 = 94px, 12px to spare) that
        // just adds the shared Button component's hover/focus/disabled/
        // press-scale behavior on top.
        "icon-xs": "size-3.5",
        // Emits no sizing classes at all — for variants (editorPrimary)
        // that bake their own height/padding into the variant string, so
        // the size axis never has conflicting height/padding to resolve
        // against.
        none: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "primary",
  size = "default",
  asChild = false,
  loading = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
