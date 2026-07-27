"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";

// Root-level error boundary — catches any uncaught error in a page/layout
// below the root layout (global-error.tsx is the separate, more extreme
// fallback for an error in the root layout itself). One shared boundary
// for the whole app, not one per route group — kept minimal per this
// task's explicit "do not redesign" instruction; a different look per
// section wasn't asked for and isn't needed for a generic error state.
//
// `relative` on the root wrapper — same stacking-context requirement as
// every other full-page wrapper in this app (see (marketing)/layout.tsx's
// 2026-07-27 fix): this renders inside the root layout, underneath the
// same global fixed-position BackgroundEngine canvas.
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Plain console.error, not lib/observability/logger — that logger wraps
    // `pino` directly (Node-only: process.pid, worker threads), which
    // cannot run in a browser bundle. This file is a client component by
    // Next.js's own requirement (error boundaries only work client-side),
    // so console.error is the correct, standard pattern here — matches
    // Next.js's own documented example for error.tsx.
    console.error(error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <Container className="flex max-w-md flex-col items-center gap-4 text-center">
        <h1 className="text-heading-1 text-neutral-900">Something went wrong</h1>
        <p className="text-body-md text-neutral-500">
          An unexpected error occurred. Please try again, or come back later if the problem continues.
        </p>
        <Button type="button" variant="primary" onClick={() => reset()}>
          Try again
        </Button>
      </Container>
    </div>
  );
}
