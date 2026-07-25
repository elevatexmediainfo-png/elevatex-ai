// Validates and lightly cleans the user's raw prompt before it reaches the
// image provider. Pure function — no I/O, negligible cost.
//
// Design intent: NEVER block a generation. Always return a usable
// cleanedPrompt alongside any advisory warnings. The caller decides whether
// to swap in the cleaned version or just log the warnings.

export interface SafetyResult {
  cleanedPrompt: string;
  warnings: string[];
  wasModified: boolean;
}

// Style term pairs that contradict each other when used together.
// Order: [termA, termB] — both directions are checked.
const CONTRADICTIONS: [RegExp, RegExp, string][] = [
  [/\brealistic\b/i, /\bcartoon(ish)?\b/i, "realistic vs cartoon"],
  [/\bphotorealistic\b/i, /\banimat(ed|ion)\b/i, "photorealistic vs animated"],
  [/\bminimalist\b/i, /\bmaximalist\b/i, "minimalist vs maximalist"],
  [/\bdark\s+(background|mood|theme|aesthetic)\b/i, /\bbright\s+(background|mood|theme|aesthetic)\b/i, "dark vs bright theme"],
  [/\bblack\s+and\s+white\b/i, /\bfull[- ]colo(u)?r\b/i, "black-and-white vs full colour"],
  [/\bvintage\b/i, /\bfuturistic\b/i, "vintage vs futuristic"],
  [/\bno\s+text\b/i, /\b(with\s+)?(headline|copy|caption|overlaid text)\b/i, "no text vs text overlay"],
  [/\bblurred?\s+background\b/i, /\bsharp\s+background\b/i, "blurred vs sharp background"],
];

const MAX_PROMPT_LENGTH = 5000;
const EXCESSIVE_REPEAT_THRESHOLD = 4;

export function validatePromptSafety(prompt: string): SafetyResult {
  const warnings: string[] = [];
  let cleaned = prompt.trim();
  const original = cleaned;

  // 1. Hard-truncate runaway prompts.
  if (cleaned.length > MAX_PROMPT_LENGTH) {
    cleaned = cleaned.slice(0, MAX_PROMPT_LENGTH).trimEnd();
    warnings.push(`Prompt truncated to ${MAX_PROMPT_LENGTH} characters to prevent generation errors.`);
  }

  // 2. Flag contradictory instruction pairs. We warn but do not remove either
  //    term — the model may handle them reasonably, and removing one silently
  //    would change the user's intent in ways they cannot predict.
  for (const [termA, termB, label] of CONTRADICTIONS) {
    if (termA.test(cleaned) && termB.test(cleaned)) {
      warnings.push(`Conflicting instructions detected (${label}). Results may be unpredictable.`);
    }
  }

  // 3. Warn on words repeated more than EXCESSIVE_REPEAT_THRESHOLD times —
  //    keyword stuffing can confuse image models.
  const wordFreq = new Map<string, number>();
  for (const word of cleaned.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? []) {
    wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
  }
  for (const [word, count] of wordFreq) {
    if (count > EXCESSIVE_REPEAT_THRESHOLD) {
      warnings.push(`"${word}" appears ${count} times — excessive repetition may reduce quality.`);
    }
  }

  // 4. Normalize punctuation clusters (!!!! → !!, ???? → ??, ...... → ...).
  const withoutPuncCluster = cleaned.replace(/([!?.]){3,}/g, "$1$1");
  if (withoutPuncCluster !== cleaned) {
    cleaned = withoutPuncCluster;
    warnings.push("Excessive punctuation was normalized.");
  }

  // 5. Collapse triple+ blank lines into double (cleaner for LLM context).
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return {
    cleanedPrompt: cleaned,
    warnings,
    wasModified: cleaned !== original,
  };
}
