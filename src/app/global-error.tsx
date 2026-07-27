"use client";

// Next.js requirement: global-error.tsx replaces the ROOT layout entirely
// when an error occurs there (the one place in this app where duplicating
// <html>/<body> is intentional, not a mistake). Deliberately has zero
// dependency on any other app component (no Button, no Container, no
// providers) — this is the last line of defense; importing something that
// could itself fail would defeat the point. Plain Tailwind utility classes
// only, matching the existing design tokens (bg-accent-orange primary
// button, text-heading-1/text-body-md typography) for visual consistency
// without a hard component dependency.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="relative flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4 text-center">
        <h1 className="text-heading-1 text-neutral-900">Something went wrong</h1>
        <p className="max-w-md text-body-md text-neutral-500">
          An unexpected error occurred. Please try again, or come back later if the problem continues.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex shrink-0 items-center justify-center rounded-md bg-accent-orange px-4 py-2 text-label-md text-neutral-900 transition-colors hover:bg-accent-orange-dark"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
