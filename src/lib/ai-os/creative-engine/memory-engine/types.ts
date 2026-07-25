// Phase 10.4.0 — Memory Engine interface contract.
// Wraps creative-knowledge/creative-memory/ (Phase 10.4).
//
// Phase 10.4.0: contracts only — no storage implementation.
// Phase 10.4E:  implements write() — DB upsert after generation completes.
// Phase 10.4F:  implements read() — supplies HistorySignal to Route Engine
//               and recentFingerprints to Diversity Engine.
//
// The memory engine is the only engine that is async (requires DB I/O).
// All other engines in the pipeline are synchronous pure functions.

import type { KnowledgeStore } from "../../creative-knowledge/store";
import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { KnowledgeTrace } from "../types";
import type { CreativeMemoryEntry } from "../../creative-knowledge/creative-memory/types";

// ── Write ─────────────────────────────────────────────────────────────────────

export interface MemoryWriteInput {
  userId: string;
  /** Entry without id and timestamp — the engine generates these at write time. */
  entry:  Omit<CreativeMemoryEntry, "id" | "timestamp">;
}

export interface MemoryWriteOutput {
  /** UUID assigned to the stored entry. */
  entryId: string;
  stored:  boolean;
  trace:   KnowledgeTrace;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export interface MemoryReadInput {
  userId:    string;
  industry?: SceneIndustry;
  /** Maximum number of recent entries to return. Defaults to 10. */
  limit:     number;
  /** Return only entries generated within this many milliseconds. */
  sinceMs?:  number;
}

export interface MemoryReadOutput {
  entries:      CreativeMemoryEntry[];
  /** Fingerprints extracted from entries — ready for Diversity Engine input. */
  fingerprints: string[];
  trace:        KnowledgeTrace;
}

// ── Runner contracts ──────────────────────────────────────────────────────────

export type MemoryWriteRunner = (
  input: MemoryWriteInput,
  store: KnowledgeStore,
) => Promise<MemoryWriteOutput>;

export type MemoryReadRunner = (
  input: MemoryReadInput,
  store: KnowledgeStore,
) => Promise<MemoryReadOutput>;
