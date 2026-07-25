"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Milestone 24 — the Cloud Video Editor is the first place in this codebase
// to use TanStack Query, deliberately scoped to this route group rather
// than added to the root layout: nothing outside /editor needs it yet, and
// this module's server state (projects/folders/assets/tracks/clips) is
// wholly separate from the rest of the app's ad hoc fetch-in-useCallback
// pattern.
export function EditorQueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
