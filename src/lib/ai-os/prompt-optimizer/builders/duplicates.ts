import type { PromptSpecification } from "../../prompt-spec/types";
import type { DuplicateReport } from "../types";
import { similarity } from "./shared";

// Builder 3 — Duplicate Detection
// Detects semantically similar content across different sections and reports them.
// Does NOT remove duplicates (the compressed spec handles simplification);
// this builder reports what was found for quality scoring.

const SIMILARITY_THRESHOLD = 0.55; // 55% word overlap = likely duplicate

export function buildDuplicateReport(spec: PromptSpecification): DuplicateReport {
  // Collect all field values with their locations
  const fields: Array<{ key: string; value: string }> = [];

  function collect(section: Record<string, unknown>, prefix: string) {
    for (const [k, v] of Object.entries(section)) {
      if (v && typeof v === "object" && "value" in v && typeof (v as { value: unknown }).value === "string") {
        const val = (v as { value: string }).value;
        if (val !== "unknown" && val.length > 20) {
          fields.push({ key: `${prefix}.${k}`, value: val });
        }
      }
    }
  }

  collect(spec.mission             as unknown as Record<string, unknown>, "mission");
  collect(spec.hero                as unknown as Record<string, unknown>, "hero");
  collect(spec.supporting          as unknown as Record<string, unknown>, "supporting");
  collect(spec.environment         as unknown as Record<string, unknown>, "environment");
  collect(spec.negativeConstraints as unknown as Record<string, unknown>, "negative");

  const mergedItems: string[] = [];
  const reported = new Set<string>();

  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      const pairKey = `${fields[i].key}|${fields[j].key}`;
      if (reported.has(pairKey)) continue;
      const sim = similarity(fields[i].value, fields[j].value);
      if (sim >= SIMILARITY_THRESHOLD) {
        reported.add(pairKey);
        mergedItems.push(
          `${fields[i].key} ↔ ${fields[j].value.slice(0, 60)}... (${Math.round(sim * 100)}% overlap with ${fields[j].key})`
        );
      }
    }
  }

  return { totalFound: mergedItems.length, mergedItems };
}
