import { Loader2 } from "lucide-react";

// One shared root-level loading fallback — shown only while a route
// segment's own server-side data fetching is in flight, and only for
// segments that don't define a more specific loading.tsx of their own
// (none currently do). Same Loader2 spinner already used throughout this
// app (install-wizard.tsx, login/page.tsx, etc.) — no new visual pattern.
//
// `relative` on the root wrapper — same stacking-context requirement as
// every other full-page wrapper in this app (see (marketing)/layout.tsx's
// 2026-07-27 fix): this renders inside the root layout, underneath the
// same global fixed-position BackgroundEngine canvas.
export default function Loading() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-white">
      <Loader2 className="size-6 animate-spin text-neutral-400" />
    </div>
  );
}
