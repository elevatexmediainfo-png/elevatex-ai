import type { AspectRatio } from "@/generated/prisma/enums";
import type { EditorAspectRatio } from "@/generated/prisma/enums";

// Shared by every AI Video orchestrator that creates a minimal EditorProject
// from a platform AspectRatio (Phase 1's Animated Poster Video, Phase 3b's
// clip chain/merge) — the platform's AspectRatio and the Editor's own
// EditorAspectRatio enums share the same 3 values, so this is a straight
// lookup, not a conversion, but the target pixel dimensions still need to
// be picked somewhere once, not per caller.
export const EDITOR_DIMENSIONS_BY_ASPECT: Record<
  AspectRatio,
  { editorAspectRatio: EditorAspectRatio; widthPx: number; heightPx: number }
> = {
  RATIO_9_16: { editorAspectRatio: "RATIO_9_16", widthPx: 1080, heightPx: 1920 },
  RATIO_1_1: { editorAspectRatio: "RATIO_1_1", widthPx: 1080, heightPx: 1080 },
  RATIO_16_9: { editorAspectRatio: "RATIO_16_9", widthPx: 1920, heightPx: 1080 },
};
