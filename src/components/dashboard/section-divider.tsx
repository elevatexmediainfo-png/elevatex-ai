// A gradient-fade hairline between dashboard sections — fades to
// transparent at both ends instead of a hard `border-b`, for a softer,
// more deliberate visual rhythm than plain whitespace alone.
export function SectionDivider() {
  return <div aria-hidden className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />;
}
