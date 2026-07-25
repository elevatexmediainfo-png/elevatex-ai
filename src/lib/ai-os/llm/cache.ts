// In-memory response cache for AI OS LLM calls.
// Prevents redundant LLM requests for identical prompts within the TTL window.
// Image analysis (image_analysis task) is intentionally excluded — image content
// can change even if the URL remains the same.
// Health checks are also excluded — they measure live latency, not cached state.

import type { AILLMResponse, LLMTaskType } from "./types";

const TTL_MS = 5 * 60 * 1_000; // 5 minutes
const MAX_ENTRIES = 500;

const CACHEABLE: ReadonlySet<LLMTaskType> = new Set([
  "analysis",
  "json_extraction",
  "creative_text",
  "translation",
]);

interface CacheEntry {
  response: AILLMResponse;
  expiresAt: number;
}

const _store = new Map<string, CacheEntry>();

function key(prompt: string, taskType: string, language: string): string {
  // Truncate prompt so keys stay bounded; full prompt identity is preserved
  // well enough for the first 300 characters in practice.
  return `${taskType}|${language}|${prompt.slice(0, 300)}`;
}

function evictExpired(): void {
  const now = Date.now();
  for (const [k, entry] of _store) {
    if (now > entry.expiresAt) _store.delete(k);
  }
}

export function isCacheable(taskType: LLMTaskType): boolean {
  return CACHEABLE.has(taskType);
}

export function getCached(
  prompt: string,
  taskType: LLMTaskType,
  language: string,
): AILLMResponse | null {
  if (!isCacheable(taskType)) return null;
  const entry = _store.get(key(prompt, taskType, language));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _store.delete(key(prompt, taskType, language));
    return null;
  }
  return { ...entry.response, cached: true };
}

export function setCached(
  prompt: string,
  taskType: LLMTaskType,
  language: string,
  response: AILLMResponse,
  ttlMs = TTL_MS,
): void {
  if (!isCacheable(taskType)) return;

  // Lazy eviction: clear expired entries when approaching the size limit.
  if (_store.size >= MAX_ENTRIES) evictExpired();
  // If still at capacity after eviction, drop the oldest entry.
  if (_store.size >= MAX_ENTRIES) {
    const first = _store.keys().next().value;
    if (first !== undefined) _store.delete(first);
  }

  _store.set(key(prompt, taskType, language), {
    response: { ...response, cached: false },
    expiresAt: Date.now() + ttlMs,
  });
}

/** Clear the entire cache (use in tests or after provider config changes). */
export function clearLLMCache(): void {
  _store.clear();
}

/** Current cache entry count (for diagnostics). */
export function llmCacheSize(): number {
  return _store.size;
}
