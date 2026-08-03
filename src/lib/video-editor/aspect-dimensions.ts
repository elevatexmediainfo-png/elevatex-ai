import type { AspectRatio } from "@/generated/prisma/enums";
import type { EditorAspectRatio } from "@/generated/prisma/enums";

// Shared by every AI Video orchestrator that creates a minimal EditorProject
// from a platform AspectRatio (Phase 1's Animated Poster Video, Phase 3b's
// clip chain/merge) — the platform's AspectRatio and the Editor's own
// EditorAspectRatio enums shared the same 3 values originally, so this was a
// straight lookup, not a conversion, but the target pixel dimensions still
// need to be picked somewhere once, not per caller.
//
// Marketing Templates (2026-08-03) — 5 new AspectRatio values (IMAGE output
// only, see aspect-ratios.ts). EditorAspectRatio only has one matching named
// preset for these (RATIO_4_5); the other 4 have no equivalent editor
// preset and map to CUSTOM, same escape hatch already used for arbitrary
// user-uploaded dimensions. Pixel targets keep the same 1080px baseline the
// original 3 entries use, scaled to each exact ratio.
export const EDITOR_DIMENSIONS_BY_ASPECT: Record<
  AspectRatio,
  { editorAspectRatio: EditorAspectRatio; widthPx: number; heightPx: number }
> = {
  RATIO_1_1: { editorAspectRatio: "RATIO_1_1", widthPx: 1080, heightPx: 1080 },
  RATIO_4_5: { editorAspectRatio: "RATIO_4_5", widthPx: 1080, heightPx: 1350 },
  RATIO_3_4: { editorAspectRatio: "CUSTOM", widthPx: 1080, heightPx: 1440 },
  RATIO_2_3: { editorAspectRatio: "CUSTOM", widthPx: 1080, heightPx: 1620 },
  RATIO_9_16: { editorAspectRatio: "RATIO_9_16", widthPx: 1080, heightPx: 1920 },
  RATIO_16_9: { editorAspectRatio: "RATIO_16_9", widthPx: 1920, heightPx: 1080 },
  RATIO_3_2: { editorAspectRatio: "CUSTOM", widthPx: 1620, heightPx: 1080 },
  RATIO_4_3: { editorAspectRatio: "CUSTOM", widthPx: 1440, heightPx: 1080 },
};
