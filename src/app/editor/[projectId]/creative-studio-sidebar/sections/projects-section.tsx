"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderOpen } from "lucide-react";

import { EmptyState } from "../shared/empty-state";

// Projects — links back to the real Project Browser (/editor, already
// built and working) rather than re-fetching/duplicating that list here.
// The "other projects" placeholder grid is UI-only until this section gets
// its own scoped query (e.g. "recent projects" separate from the full
// browser).
export function ProjectsSection() {
  const router = useRouter();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-editor-line p-3">
        <h2 className="text-label-sm text-neutral-200">Projects</h2>
        <Link href="/editor" className="flex items-center gap-1 text-caption text-editor-accent hover:underline">
          Browse all
          <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <EmptyState
          icon={FolderOpen}
          title="Recent projects"
          description="Your other projects will appear here for quick access."
          actionLabel="Browse all projects"
          onAction={() => router.push("/editor")}
        />
      </div>
    </div>
  );
}
