// Phase 2a — small hand-authored icon set for benefit chips.
//
// Plain vector primitives (polyline/circle/polygon/line), not emoji, not a
// font glyph. Measured directly against the actual sharp/SVG rendering
// pipeline while building the contact bar: emoji rendered as thin
// monochrome fallback glyphs there, dependent on whatever font coverage the
// running machine happens to have — fine on a dev box, not guaranteed on a
// production Linux container. These render identically everywhere sharp
// runs, because they're just shapes, not characters.
//
// Deliberately generic (no per-industry semantics, no content-matching to
// pick "the right" icon for a given benefit's meaning) — that's a real,
// separate feature for later. For now, chips cycle through this set in a
// fixed order.

export type IconName = "checkmark" | "shield" | "star" | "clock";

export const ICON_ROTATION: readonly IconName[] = ["checkmark", "shield", "star", "clock"];

// Each icon is authored in a 24x24 local coordinate space and positioned
// via a <g transform="translate(...) scale(...)"> wrapper in renderIcon()
// — resolution-independent, sized the same way font-size scaling works
// elsewhere in this file (relative to the 1080px reference width).
const ICON_MARKUP: Record<IconName, string> = {
  checkmark:
    `<polyline points="4,13 9,18 20,6" fill="none" stroke="white" stroke-width="2.5" ` +
    `stroke-linecap="round" stroke-linejoin="round"/>`,
  shield:
    `<path d="M12,2 L20,5.5 L20,11 C20,16.5 16.5,20 12,22 C7.5,20 4,16.5 4,11 L4,5.5 Z" ` +
    `fill="none" stroke="white" stroke-width="2" stroke-linejoin="round"/>`,
  star:
    `<polygon points="12,2 14.9,9 22,9.5 16.5,14.2 18.2,21.5 12,17.5 5.8,21.5 7.5,14.2 2,9.5 9.1,9" fill="white"/>`,
  clock:
    `<circle cx="12" cy="12" r="9" fill="none" stroke="white" stroke-width="2"/>` +
    `<line x1="12" y1="12" x2="12" y2="6.5" stroke="white" stroke-width="2" stroke-linecap="round"/>` +
    `<line x1="12" y1="12" x2="16" y2="14.5" stroke="white" stroke-width="2" stroke-linecap="round"/>`,
};

/** Renders `name` centered at (cx, cy), `size` px square. */
export function renderIcon(name: IconName, cx: number, cy: number, size: number): string {
  const scale = size / 24;
  const tx = cx - size / 2;
  const ty = cy - size / 2;
  return `<g transform="translate(${tx},${ty}) scale(${scale.toFixed(3)})">${ICON_MARKUP[name]}</g>`;
}
