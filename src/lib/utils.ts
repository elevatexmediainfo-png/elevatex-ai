import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind-merge can't infer our custom @theme tokens by name alone — without
// this, e.g. `text-label-lg` (font-size) and `text-brand-navy` (color) both
// start with "text-" and get treated as the same conflicting group, silently
// dropping one of them. Register our custom suffixes into the right group.
const CUSTOM_FONT_SIZES = [
  "display-1",
  "display-2",
  "heading-1",
  "heading-2",
  "heading-3",
  "body-lg",
  "body-md",
  "body-sm",
  "caption",
  "label-lg",
  "label-md",
  "label-sm",
  "mono",
  // Editor-scoped tokens (2026-07-15 — found live: `text-nano`/
  // `text-editor-caption` etc. were silently dropped from the DOM
  // whenever combined with an editor-scoped TEXT COLOR class
  // (`text-editor-accent`) in the same cn() call — neither suffix was
  // registered, so tailwind-merge fell back to prefix-only inference,
  // saw both start with "text-", and treated them as one conflicting
  // group, keeping only whichever came last. Same class of gap this
  // file's own comment already describes for the sitewide tokens above,
  // just never extended to the editor's own scale.
  "micro",
  "nano",
  "editor-heading",
  "editor-panel-title",
  "editor-body",
  "editor-caption",
]

const CUSTOM_COLORS = [
  "brand-navy",
  "brand-navy-dark",
  "brand-navy-light",
  "accent-orange",
  "accent-orange-dark",
  "accent-orange-light",
  "success",
  "success-light",
  "warning",
  "warning-light",
  "error",
  "error-light",
  "info",
  "info-light",
  "neutral-50",
  "neutral-100",
  "neutral-200",
  "neutral-300",
  "neutral-400",
  "neutral-500",
  "neutral-700",
  "neutral-900",
  "surface-0",
  "surface-1",
  "surface-2",
  "platform-instagram",
  "platform-facebook",
  "platform-youtube",
  "platform-whatsapp",
  "platform-google",
  "platform-linkedin",
  "vertical-restaurant",
  "vertical-salon",
  "vertical-dental",
  "vertical-realestate",
  "vertical-retail",
  "vertical-gym",
  "vertical-hospital",
  "vertical-coaching",
  "vertical-hotel",
  "vertical-other",
  // Editor-scoped tokens (2026-07-15 — see CUSTOM_FONT_SIZES's own comment
  // above for the bug this closes: text-editor-accent specifically was the
  // color half of the silent-drop pattern, stripping text-nano/
  // text-editor-caption out of the DOM wherever both landed in one cn()
  // call, e.g. any "active" conditional class like `active ?
  // "text-editor-accent" : "text-neutral-400"` paired with a base
  // font-size class).
  "editor-bg",
  "editor-panel",
  "editor-line",
  "editor-surface-1",
  "editor-surface-2",
  "editor-accent",
  "editor-danger",
]

// Fix (2026-07-13) — found live: a new cva Button variant (editorPrimary)
// combined its own `rounded-editor-button` with the base buttonVariants
// string's `rounded-md`, and without registering the custom radius token
// here, tailwind-merge didn't recognize them as the same conflicting group
// — both classes survived into the DOM, and whichever's stylesheet rule
// happened to come later in Tailwind's own generated CSS silently won
// (rounded-md, not the intended 14px). Same class of gap the file's own
// existing comment already describes for font-size/text-color, just never
// extended to radius/shadow. Also covers shadow-editor-card proactively —
// not yet demonstrated broken, but the same design-system token family, so
// the same silent-conflict risk applies the moment it's ever combined with
// a base shadow-* class the way rounded-editor-button was.
const CUSTOM_RADIUS = ["editor-button", "editor-card", "editor-clip"]
const CUSTOM_SHADOW = ["editor-card"]
// Same gap, same fix (2026-07-15) — found live: `editorPrimary`'s own
// baked-in `h-editor-button-height` (44px) and a call site's `h-8`
// override (32px) both survived into the DOM since neither was a
// registered "height" classGroup member; the CSS cascade (not the
// override) then silently picked 44px regardless of which class came
// later in the className string. Registered under height/min-height/
// max-height together since this token's own name ("button height") is
// generic enough to plausibly get combined with any of the three.
const CUSTOM_SPACING = ["editor-button-height"]

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: CUSTOM_FONT_SIZES }],
      "text-color": [{ text: CUSTOM_COLORS }],
      rounded: [{ rounded: CUSTOM_RADIUS }],
      shadow: [{ shadow: CUSTOM_SHADOW }],
      h: [{ h: CUSTOM_SPACING }],
      "min-h": [{ "min-h": CUSTOM_SPACING }],
      "max-h": [{ "max-h": CUSTOM_SPACING }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs))
}
