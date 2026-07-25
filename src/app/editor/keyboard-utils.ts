const TEXT_EDITABLE_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "week",
  "time",
]);

// Shared by every module's global keydown handler (top-toolbar.tsx's
// undo/redo, timeline-panel.tsx's split/delete/duplicate/group/marker/zoom/
// play-pause shortcuts) — a bare `tagName === "INPUT"` check would also
// block shortcuts whenever a <input type="range"> (every Transform/Crop/
// Blend slider, the Preview Window's seek bar) happens to have focus, even
// though range/checkbox/radio/button inputs have no native text-undo or
// typed-character behavior of their own to protect. Only genuinely
// text-editable controls should suppress a single-letter shortcut like "s".
export function isTextEditableTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return TEXT_EDITABLE_INPUT_TYPES.has(target.type);
  return false;
}

export function resolveEditorSeekDelta(e: KeyboardEvent, frameMs: number): { direction: 1 | -1; stepMs: number } | null {
  if (e.key === "ArrowLeft") {
    return { direction: -1, stepMs: e.shiftKey ? 1000 : frameMs };
  }
  if (e.key === "ArrowRight") {
    return { direction: 1, stepMs: e.shiftKey ? 1000 : frameMs };
  }
  return null;
}
