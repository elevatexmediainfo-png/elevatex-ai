import {
  createDeleteClipCommand,
  createRemoveTransitionCommand,
  createReplaceClipSourceCommand,
  createUpdateContentCommand,
  createUpdateTransformCommand,
  type ClipCommandDeps,
  type EditorCommand,
  type TransitionCommandDeps,
} from "./commands";
import { DEFAULT_CLIP_TRANSFORM, type ClipTransform } from "@/lib/video-editor/transform";
import { DEFAULT_REVEAL_CONFIG } from "@/lib/video-editor/text-style";
import type { ClipContent, ClipView, TransitionView } from "../types";
import type { ReeditClipResult } from "@/lib/video-editor/ai-reedit";

// Phase 12 Module 9 — pulled out of the prompt UI component into its own
// plain module (same "pure logic lives outside JSX files" reasoning as
// ai-review-selection.ts, Module 7) so it's directly unit-testable. Maps
// a validated re-edit response onto the EXACT SAME command constructors
// every other Timeline mutation in this app already uses — never a new
// mutation path, and always exactly ONE command (re-edit is single-clip,
// single-action by design; no composite needed).
//
// Returns `{ command }` when the response maps to a real, ready-to-run
// action, or `{ error }` — for the model's own "cannot_do" response, for
// a genuinely malformed response the schema's own `.refine()` should
// already have caught (defensive, not expected to fire), or for a
// "change_asset" whose search came back with no match (resolutionNote
// from the server, not a forced placeholder).
export type ReeditCommandMapResult = { command: EditorCommand } | { error: string };

export function mapReeditResponseToCommand(
  result: ReeditClipResult,
  clip: ClipView,
  transitions: TransitionView[],
  deps: ClipCommandDeps,
  transitionDeps: TransitionCommandDeps
): ReeditCommandMapResult {
  const { response } = result;

  if (response.action === "cannot_do") {
    return { error: response.message };
  }

  if (response.action === "delete_clip") {
    return { command: createDeleteClipCommand(deps, clip) };
  }

  if (response.action === "remove_effect") {
    if (response.effect === "zoom") {
      const previous = clip.transform ?? DEFAULT_CLIP_TRANSFORM;
      // Resets to native size, not just "stop animating at whatever
      // value it happened to be at" — "remove the zoom" reads as "make
      // it normal again," not "freeze the current frame's zoom level."
      const next: ClipTransform = { ...previous, scale: { value: 100, keyframes: null } };
      return { command: createUpdateTransformCommand(deps, clip.id, previous, next) };
    }
    const side = response.effect === "transition_before" ? "before" : "after";
    const transition = transitions.find((t) => (side === "before" ? t.clipBId === clip.id : t.clipAId === clip.id));
    if (!transition) return { error: `No transition found ${side} this clip.` };
    return { command: createRemoveTransitionCommand(transitionDeps, transition) };
  }

  if (response.action === "change_asset") {
    if (!result.resolvedAssetId) {
      return { error: result.resolutionNote ?? "Couldn't find a matching replacement." };
    }
    return { command: createReplaceClipSourceCommand(deps, clip.id, clip.assetId, result.resolvedAssetId) };
  }

  if (response.action === "adjust_transform") {
    const previous = clip.transform ?? DEFAULT_CLIP_TRANSFORM;
    let next: ClipTransform;
    if (response.property === "position") {
      if (typeof response.value !== "object") return { error: "Malformed instruction: position needs an {x,y} value." };
      next = { ...previous, position: { value: response.value, keyframes: null } };
    } else {
      if (typeof response.value !== "number") return { error: "Malformed instruction: expected a numeric value." };
      const value = response.value;
      switch (response.property) {
        case "scale":
          next = { ...previous, scale: { value, keyframes: null } };
          break;
        case "rotation":
          next = { ...previous, rotation: { value, keyframes: null } };
          break;
        case "opacity":
          next = { ...previous, opacity: { value, keyframes: null } };
          break;
      }
    }
    return { command: createUpdateTransformCommand(deps, clip.id, previous, next) };
  }

  // response.action === "change_caption_style"
  const previous = clip.content;
  const next: ClipContent = { ...(previous ?? {}) };
  if (response.reveal) {
    next.reveal = { ...(previous?.reveal ?? DEFAULT_REVEAL_CONFIG), ...response.reveal };
  }
  if (response.color) next.color = response.color;
  if (response.fontSize) next.fontSize = response.fontSize;
  return { command: createUpdateContentCommand(deps, clip.id, previous, next) };
}
