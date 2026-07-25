import type { ProjectMetadata, MemoryReferences } from "./types";
import { SCHEMA_VERSION, AI_OS_VERSION, KNOWLEDGE_VERSION, generateBlueprintId } from "./versioning";

// Phase 9 — Blueprint metadata generators.

/** Assembles the ProjectMetadata section of the Blueprint. */
export function buildProjectMetadata(projectId?: string): ProjectMetadata {
  return {
    projectId,
    blueprintId: generateBlueprintId(),
    createdAt: new Date().toISOString(),
    aiOsVersion: AI_OS_VERSION,
    schemaVersion: SCHEMA_VERSION,
    knowledgeVersion: KNOWLEDGE_VERSION,
  };
}

/** Assembles the MemoryReferences section — all placeholder slots set to null. */
export function buildMemoryReferences(currentProjectId?: string): MemoryReferences {
  return {
    currentProjectId,
    pastVersionIds: [],
    _futureEmbeddings: null,
    _futureLearning: null,
    _futureBrandMemory: null,
  };
}
