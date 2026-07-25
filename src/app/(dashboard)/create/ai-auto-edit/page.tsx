import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { createProject } from "@/lib/video-editor/projects";
import { EDITOR_DIMENSIONS_BY_ASPECT } from "@/lib/video-editor/aspect-dimensions";

// Fix (2026-07-18) — the "Upload Your Video" tile on /create used to point
// at /create/talking-head (the legacy Scene-based Talking Head flow), even
// though its own copy ("Upload your own footage — AI edits, captions, and
// polishes it") describes Phase 12's AI Auto-Edit feature, not that one —
// a real, misleading bug, not a naming coincidence. This route is the new
// destination: create a real Cloud Video Editor project (reusing the exact
// same createProject() the /editor project browser's own "New Project"
// button and its POST /api/editor/projects route both already call — no
// duplicated creation logic) and land straight inside it with the AI
// Auto-Edit panel pre-opened (?aiAutoEdit=1, read by top-toolbar.tsx) —
// one click from /create to a running intake form, no intermediate
// "create a project first" step the founder's own brief didn't ask for.
// RATIO_16_9 is just a starting default; the panel's own aspect-ratio
// picker (Module 8) already lets the user change it for real before running.
export default async function CreateAiAutoEditPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const dims = EDITOR_DIMENSIONS_BY_ASPECT.RATIO_16_9;
  const project = await createProject(session.user.id, {
    name: "Untitled Project",
    aspectRatio: dims.editorAspectRatio,
    widthPx: dims.widthPx,
    heightPx: dims.heightPx,
  });

  redirect(`/editor/${project.id}?aiAutoEdit=1`);
}
