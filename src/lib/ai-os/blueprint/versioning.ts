// Phase 9 — Blueprint versioning constants.
// Semver-aligned version identifiers for the Blueprint schema, the AI OS,
// and the knowledge banks. Consumers check schemaVersion to detect breaking
// changes before reading the Blueprint.

/** The version of the Blueprint schema (this file's UniversalCampaignBlueprint type).
 *  Increment the MAJOR when a breaking change is made to the Blueprint structure.
 *  Increment the MINOR when new optional fields are added. */
export const SCHEMA_VERSION = "1.0.0";

/** The version of the AI OS module set that assembled this Blueprint.
 *  Covers Phases 1–9. */
export const AI_OS_VERSION = "1.9.0";

/** The version of the knowledge banks used during assembly.
 *  Covers industry knowledge, font personalities, canvas specs, etc. */
export const KNOWLEDGE_VERSION = "1.0.0";

/** Generates a unique blueprint ID combining timestamp + entropy.
 *  Not cryptographically random — used for tracing/logging, not security. */
export function generateBlueprintId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 9);
  return `bp_${ts}_${rand}`;
}
