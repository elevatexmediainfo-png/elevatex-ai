// Phase 10.6B — Deterministic multi-axis seeding.
//
// The same djb2-xor hash technique already used throughout this pipeline
// (scene-planner/vte-bridge.ts variationSeed, prompt-spec/scene-builder.ts
// djb2, prompt-compiler's field hashing) — reused here as the established
// convention, not reinvented.
//
// The key property this module adds: every combinatorial axis (hand verb,
// head direction, material, micro-motion element, ...) gets its OWN
// independent sub-seed derived from the base seed plus the axis name. This
// is what makes the assembly genuinely combinatorial rather than a single
// lookup keyed on one hash — two axes never move in lockstep, so the output
// space is the PRODUCT of every axis's cardinality, not the size of one
// shared table.

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) | 0;
  }
  return h < 0 ? -h : h;
}

/** Base seed for one Scene Graph compilation — deterministic from campaign identity. */
export function baseSeed(blueprintId: string, industry: string, heroText: string): number {
  return djb2(`${blueprintId}::${industry}::${heroText.slice(0, 64)}`);
}

/** Independent per-axis sub-seed — same base seed, different axis name, uncorrelated result. */
export function axisSeed(base: number, axis: string): number {
  return djb2(`${base}::${axis}`);
}

/** Deterministically pick one element of a non-empty array using a seed. */
export function pick<T>(arr: readonly T[], seed: number): T {
  if (arr.length === 0) throw new Error("pick() requires a non-empty array");
  return arr[seed % arr.length]!;
}

/** Deterministically pick N distinct elements (order preserved by seed rotation). */
export function pickN<T>(arr: readonly T[], seed: number, n: number): T[] {
  if (arr.length === 0) return [];
  const count = Math.min(n, arr.length);
  const startIdx = seed % arr.length;
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    out.push(arr[(startIdx + i * 7 + 1) % arr.length]!);
  }
  return [...new Set(out)];
}

/** Deterministic boolean gate — true for `probability` share of seed space (0-1). */
export function chance(seed: number, probability: number): boolean {
  return (seed % 1000) / 1000 < probability;
}

/**
 * Pick from `options`, preferring an entry that shares a word with one of the
 * given knowledge-bridge tags (the "use existing intelligence" tie-in — a
 * scene-type tag like "wine-cellar" nudges selection toward a matching
 * vocabulary entry). Falls back to the plain seeded pick when nothing matches,
 * so the axis stays populated even when the knowledge bank has no opinion.
 */
export function pickBiased<T extends string>(options: readonly T[], seed: number, tags: readonly string[]): T {
  if (tags.length > 0) {
    const words = new Set(tags.join(" ").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
    const matches = options.filter((opt) => {
      const optWords = opt.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
      return optWords.some((w) => words.has(w));
    });
    if (matches.length > 0) return pick(matches, seed);
  }
  return pick(options, seed);
}
