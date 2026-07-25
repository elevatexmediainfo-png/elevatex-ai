import type { FieldDiff } from "./types";

// Phase 10.6D — Generic StrategyField-tree differ.
// Same flatten-by-dot-path technique already established independently in
// scene-planner/engine.ts, prompt-spec/versioning.ts, and scene-graph/engine.ts
// (each module keeps its own small copy rather than sharing one, the
// convention already established throughout this codebase) — reused here for
// the trace's own purpose: comparing two same-shaped StrategyField trees
// (e.g. a PromptSpecification before and after Scene Graph enrichment, or
// before and after Prompt Visual Compiler substitution).

type FieldLike = { value: string };

function isFieldLike(v: unknown): v is FieldLike {
  return !!v && typeof v === "object" && "value" in v && typeof (v as Record<string, unknown>).value === "string";
}

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, FieldLike> {
  const result: Record<string, FieldLike> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isFieldLike(v)) {
      result[key] = v;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(result, flatten(v as Record<string, unknown>, key));
    }
  }
  return result;
}

/**
 * Compares two same-shaped StrategyField trees by dot-path.
 *   added    — path had "unknown" (or was absent) before, has real content after
 *   removed  — path had real content before, is "unknown" (or absent) after
 *   modified — path has different, both-real content before and after
 */
export function diffFieldTrees(before: Record<string, unknown>, after: Record<string, unknown>): FieldDiff {
  const beforeFlat = flatten(before);
  const afterFlat = flatten(after);
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  const allKeys = new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)]);
  for (const key of allKeys) {
    const b = beforeFlat[key]?.value;
    const a = afterFlat[key]?.value;
    const bReal = b !== undefined && b !== "unknown";
    const aReal = a !== undefined && a !== "unknown";

    if (!bReal && aReal) { added.push(key); continue; }
    if (bReal && !aReal) { removed.push(key); continue; }
    if (bReal && aReal && b !== a) { modified.push(key); continue; }
  }

  return { added: added.sort(), removed: removed.sort(), modified: modified.sort() };
}

/** Count of "unknown"-valued leaves in a StrategyField tree — the same
 *  denominator every domain object's own `unknownFields`/`completenessScore`
 *  is computed from, recomputed here so the trace works uniformly across
 *  stages whether or not that stage's own type happens to expose the count. */
export function countUnknownFields(obj: Record<string, unknown>): number {
  const flat = flatten(obj);
  return Object.values(flat).filter((f) => f.value === "unknown").length;
}

/** Flattens a StrategyField tree into path -> value pairs, omitting
 *  "unknown" leaves — the lookup table the influence graph matches provider
 *  prompt sentences against. */
export function flattenPaths(obj: Record<string, unknown>): Record<string, string> {
  const flat = flatten(obj);
  const result: Record<string, string> = {};
  for (const [path, field] of Object.entries(flat)) {
    if (field.value !== "unknown") result[path] = field.value;
  }
  return result;
}

/** Joins every real (non-"unknown") StrategyField value in a tree into one
 *  blob — gives every stage's output a measurable text signal (token count,
 *  visual/abstract ratio) regardless of that stage's specific shape, without
 *  requiring a bespoke text-getter per stage. */
export function flattenToText(obj: Record<string, unknown>): string {
  const flat = flatten(obj);
  return Object.values(flat)
    .map((f) => f.value)
    .filter((v) => v !== "unknown")
    .join(". ");
}
