import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";

// One shared 404 for the whole app — same "minimal, not per-section"
// reasoning as error.tsx. Server component (no interactivity needed, unlike
// error.tsx which Next.js requires to be client-side for its reset()).
//
// `relative` on the root wrapper — same stacking-context requirement as
// every other full-page wrapper in this app (see (marketing)/layout.tsx's
// 2026-07-27 fix): this renders inside the root layout, underneath the
// same global fixed-position BackgroundEngine canvas.
export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <Container className="flex max-w-md flex-col items-center gap-4 text-center">
        <h1 className="text-heading-1 text-neutral-900">Page not found</h1>
        <p className="text-body-md text-neutral-500">
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
        </p>
        <Button asChild variant="primary">
          <Link href="/">Back to home</Link>
        </Button>
      </Container>
    </div>
  );
}
