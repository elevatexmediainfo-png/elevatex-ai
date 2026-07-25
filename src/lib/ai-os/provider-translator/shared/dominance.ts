// Phase 10.4L — Prompt Dominance Measurement
//
// Measures how much of a provider prompt is devoted to each visual category.
// Image models weight early tokens heavily — hero must dominate position and
// word count, environment must not precede hero.
//
// Works with labeled block format: "LABEL\ncontent" sections separated by \n\n.

// ─────────────────────────────────────────────────────────────────────────────
// Block classification maps
// ─────────────────────────────────────────────────────────────────────────────

const HERO_LABELS: string[] = [
  "PRIMARY HERO MOMENT",
  "PRIMARY HERO",
  "VISIBLE EMOTION",
  // Phase 10.4L: hero-zone — the hero's action, message, supporting cast, and
  // required visuals are all "about" the hero, not the environment.
  "PRIMARY ACTION",
  "CAMPAIGN MANDATE",
  "SECONDARY SUBJECTS",
  "SUPPORTING DETAILS",
  "MUST INCLUDE",
];

const ENV_LABELS: string[] = [
  "SCENE",
  "SCENE ATMOSPHERE",
  "BACKGROUND",
  "BACKGROUND ACTIVITY",
  "SURFACE MATERIALS",
];

const ACTION_LABELS: string[] = [
  "STORY CONTEXT",
];

const MARKETING_LABELS: string[] = [
  "MARKETING INTENT",
  "ADVERTISEMENT ZONES",
];

const STRUCTURE_LABELS: string[] = [
  "STYLE DIRECTION",
  "CAMERA",
  "LIGHTING",
  "COMPOSITION",
];

const META_LABELS: string[] = [
  "CAMPAIGN THEME",
  "TYPOGRAPHY ZONES",
  "TYPOGRAPHY SAFE SPACE",
  "QUALITY",
  "AVOID",
  "NEGATIVE PROMPT",
];

type BlockCategory = "hero" | "environment" | "action" | "marketing" | "structure" | "meta" | "other";

function classifyLabel(rawLabel: string): BlockCategory {
  const label = rawLabel.toUpperCase().trim();
  if (HERO_LABELS.some(h => label.startsWith(h)))      return "hero";
  if (ENV_LABELS.some(e => label.startsWith(e)))        return "environment";
  if (ACTION_LABELS.some(a => label.startsWith(a)))     return "action";
  if (MARKETING_LABELS.some(m => label.startsWith(m)))  return "marketing";
  if (STRUCTURE_LABELS.some(s => label.startsWith(s)))  return "structure";
  if (META_LABELS.some(t => label.startsWith(t)))       return "meta";
  return "other";
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface BlockDominance {
  label:    string;
  category: BlockCategory;
  words:    number;
  percent:  number;   // % of total prompt words this block accounts for
  position: number;   // 0-based block index
}

export interface PromptDominance {
  /** % of total prompt words in hero-related blocks. */
  heroPercent:        number;
  /** % of total prompt words in environment-related blocks. */
  environmentPercent: number;
  /** % of total prompt words in marketing-related blocks. */
  marketingPercent:   number;
  /** % of total prompt words in action/story blocks. */
  actionPercent:      number;
  /** 0-based position of the first hero block; -1 if absent. */
  heroBlockIndex:     number;
  /** 0-based position of the first environment block; -1 if absent. */
  environmentBlockIndex: number;
  /** True when the first hero block appears before the first environment block. */
  heroBeforeEnvironment: boolean;
  /** The label of the first block in the prompt. */
  firstBlockLabel:    string;
  /** All block labels in order. */
  blockOrder:         string[];
  /** Per-block breakdown. */
  blocks:             BlockDominance[];
  /** Total word count across all blocks. */
  totalWords:         number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Measurement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Measures the dominance of each visual category in a labeled-block prompt.
 * Labeled block format: LABEL and content separated by "\n", blocks by "\n\n".
 */
export function measureDominance(prompt: string): PromptDominance {
  const rawBlocks = prompt.split("\n\n").filter(Boolean);

  const categoryCounts: Record<BlockCategory, number> = {
    hero: 0, environment: 0, action: 0,
    marketing: 0, structure: 0, meta: 0, other: 0,
  };

  const blockDetails: BlockDominance[] = [];
  let heroBlockIndex = -1;
  let environmentBlockIndex = -1;
  const blockOrder: string[] = [];

  for (let i = 0; i < rawBlocks.length; i++) {
    const block    = rawBlocks[i]!;
    const label    = block.split("\n")[0]!.trim();
    const category = classifyLabel(label);
    const words    = countWords(block);

    categoryCounts[category] += words;
    blockOrder.push(label);
    blockDetails.push({ label, category, words, percent: 0, position: i });

    if (category === "hero"        && heroBlockIndex        === -1) heroBlockIndex        = i;
    if (category === "environment" && environmentBlockIndex === -1) environmentBlockIndex = i;
  }

  const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const pct   = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  // Back-fill per-block percent now that total is known
  for (const b of blockDetails) {
    b.percent = total > 0 ? Math.round((b.words / total) * 100) : 0;
  }

  return {
    heroPercent:           pct(categoryCounts.hero),
    environmentPercent:    pct(categoryCounts.environment),
    marketingPercent:      pct(categoryCounts.marketing),
    actionPercent:         pct(categoryCounts.action),
    heroBlockIndex,
    environmentBlockIndex,
    heroBeforeEnvironment: heroBlockIndex !== -1 && (environmentBlockIndex === -1 || heroBlockIndex < environmentBlockIndex),
    firstBlockLabel:       blockOrder[0] ?? "",
    blockOrder,
    blocks:                blockDetails,
    totalWords:            total,
  };
}

/**
 * Formats a PromptDominance report as a human-readable table string.
 * Used in test failure messages and audit reports.
 */
export function formatDominanceReport(d: PromptDominance): string {
  const rows = [
    `Hero:         ${d.heroPercent}% (block index ${d.heroBlockIndex})`,
    `Environment:  ${d.environmentPercent}% (block index ${d.environmentBlockIndex})`,
    `Action/Story: ${d.actionPercent}%`,
    `Marketing:    ${d.marketingPercent}%`,
    `First block:  ${d.firstBlockLabel}`,
    `Block order:  ${d.blockOrder.join(" → ")}`,
  ];
  return rows.join("\n");
}
