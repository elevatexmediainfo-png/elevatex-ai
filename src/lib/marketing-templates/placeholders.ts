// Marketing Templates (2026-07-24) — the ONE place that knows the
// {{placeholderName}} syntax, shared by the admin form's live preview, the
// user-facing gallery's dynamically-generated form, and the generation
// route's server-side substitution+validation — so all three can never
// disagree about what counts as a placeholder.
const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

/** Extracts the ordered, de-duplicated list of {{placeholder}} names from a prompt template. */
export function extractPlaceholders(promptTemplate: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const match of promptTemplate.matchAll(PLACEHOLDER_PATTERN)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      ordered.push(name);
    }
  }
  return ordered;
}

export class MissingPlaceholderValuesError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing values for: ${missing.join(", ")}`);
    this.name = "MissingPlaceholderValuesError";
  }
}

/**
 * Substitutes every {{placeholder}} in promptTemplate with the user's real
 * input. Throws if any placeholder the template actually declares has no
 * value — never silently leaves a literal "{{businessName}}" in the prompt
 * sent to a real generation provider.
 */
export function fillPromptTemplate(promptTemplate: string, values: Record<string, string>): string {
  const required = extractPlaceholders(promptTemplate);
  const missing = required.filter((name) => !values[name]?.trim?.());
  if (missing.length > 0) throw new MissingPlaceholderValuesError(missing);

  return promptTemplate.replace(PLACEHOLDER_PATTERN, (_match, name: string) => values[name].trim());
}
