import * as React from "react";

// Milestone 8 — undo/redo is explicitly scoped to a CLIENT-SIDE, in-memory
// command stack over text-field edits only (script text, scene prompt/
// imagePrompt/videoPrompt/negativePrompt/subtitleText) — not structural
// operations like add/delete/reorder scene, which already have their own
// explicit, visible actions and don't need an "undo" surprise. No backend
// endpoint backs this; each Command's undo()/redo() just re-applies a
// value through the same granular save functions the rest of the Studio
// already calls.

const MAX_HISTORY = 20;

export interface Command {
  undo: () => void;
  redo: () => void;
}

export function useUndoRedo() {
  const past = React.useRef<Command[]>([]);
  const future = React.useRef<Command[]>([]);
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);

  const sync = React.useCallback(() => {
    setCanUndo(past.current.length > 0);
    setCanRedo(future.current.length > 0);
  }, []);

  // Call once a text-field edit has actually been committed (e.g. after the
  // debounced autosave fires), with closures capturing the before/after
  // values needed to re-apply this exact change in either direction.
  const push = React.useCallback(
    (command: Command) => {
      past.current.push(command);
      if (past.current.length > MAX_HISTORY) past.current.shift();
      future.current = [];
      sync();
    },
    [sync]
  );

  const undo = React.useCallback(() => {
    const command = past.current.pop();
    if (!command) return;
    command.undo();
    future.current.push(command);
    sync();
  }, [sync]);

  const redo = React.useCallback(() => {
    const command = future.current.pop();
    if (!command) return;
    command.redo();
    past.current.push(command);
    sync();
  }, [sync]);

  return { push, undo, redo, canUndo, canRedo };
}
