import { AdminConfigForm } from "@/components/admin/admin-config-form";

// Real, pre-existing gap closed here (2026-07-18) — the "video_editor_policy"
// CONFIG_REGISTRY category (lib/admin/config.ts) has held 8 real settings
// since Milestone 24/Phase 12 (editor track/snap/export limits, AI Auto-
// Editor queue concurrency, silence threshold, reasoning repair attempts,
// and now the b-roll stock-only policy below) with no admin page rendering
// it at all — confirmed via a repo-wide search before adding this page.
// Minimal, same pattern as /admin/pricing: one AdminConfigForm section,
// no bespoke stats/dashboard content (the Cloud Video Editor/AI Auto-Editor
// don't have operational metrics collected anywhere yet — that's separate,
// future scope, not invented here just because a page now exists).
export default function AdminVideoEditorPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-heading-2 text-neutral-900">AI Video Editor</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Cloud Video Editor and AI Auto-Editor policy — track/export limits, AI Auto-Editor queue behavior, and b-roll
          sourcing policy.
        </p>
      </div>
      <AdminConfigForm sections={[{ category: "video_editor_policy", title: "Editor & AI Auto-Editor policy" }]} />
    </div>
  );
}
