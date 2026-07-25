import { ensureInstalled } from "@/lib/installation";
import { EditorModeActivator } from "@/components/shared/editor-mode-activator";
import { EditorQueryProvider } from "./query-provider";

// Milestone 24 — Cloud Video Editor (non-AI). Ungrouped top-level route
// (like admin/), deliberately NOT under (dashboard) — a professional
// multi-track editor needs its own full-screen chrome (Top Toolbar, Left
// Sidebar, Timeline, Bottom Status Bar), not the marketing-site header +
// sidebar + mobile bottom-nav every other authenticated page gets.
//
// force-dynamic: see (marketing)/layout.tsx's comment — without it, Next
// bakes ensureInstalled()'s redirect into a static build artifact.
export const dynamic = "force-dynamic";

export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  await ensureInstalled();

  return (
    // Fix (2026-07-13) — premium design-token foundation: was bg-surface-0,
    // a token shared with the Dashboard's own separate dark theme (see that
    // token's own comment in globals.css). Decoupled onto a dedicated
    // editor-bg token so retuning the editor's palette can never leak into
    // the Dashboard, and vice versa.
    <div className="h-screen w-screen overflow-hidden bg-editor-bg text-neutral-50">
      {/* Suppresses BackgroundEngine (3D canvas) + CursorLight (violet glow)
          globally while the editor is mounted. Uses body[data-editor] CSS rules
          in globals.css — layout-safe, zero flash, auto-restores on nav away. */}
      <EditorModeActivator />
      <EditorQueryProvider>{children}</EditorQueryProvider>
    </div>
  );
}
