import { TRANSIENT_STATUS_CODES, GenerationError, isTransientError } from "./types";

// Phase 15 — Retry strategy with exponential backoff + jitter.
// Only retries transient failures (network errors, 429, 5xx).
// Never retries validation failures (4xx) or cancelled requests.

export interface RetryConfig {
  maxRetries:   number;
  baseDelayMs:  number;  // starting delay
  maxDelayMs:   number;  // cap on delay
  jitterFactor: number;  // 0.0-1.0 randomization
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries:   3,
  baseDelayMs:  1000,
  maxDelayMs:   30000,
  jitterFactor: 0.3,
};

/** Computes the delay for attempt N (1-indexed) using exponential backoff + jitter. */
export function computeRetryDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const exponential = config.baseDelayMs * Math.pow(2, attempt - 1);
  const capped = Math.min(exponential, config.maxDelayMs);
  const jitter = capped * config.jitterFactor * Math.random();
  return Math.round(capped + jitter);
}

/** Returns true if the HTTP status code is a transient failure worth retrying. */
export function isRetryableStatusCode(statusCode: number): boolean {
  return TRANSIENT_STATUS_CODES.has(statusCode);
}

/** Executes an async function with retry logic. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void
): Promise<{ result: T; retryCount: number }> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      const result = await fn();
      return { result, retryCount: attempt - 1 };
    } catch (err) {
      lastError = err;

      // Don't retry non-transient errors
      if (!isTransientError(err)) throw err;
      if (err instanceof GenerationError && !err.isTransient) throw err;

      // Don't retry if this was the last attempt
      if (attempt > config.maxRetries) break;

      const delayMs = computeRetryDelay(attempt, config);
      if (onRetry) onRetry(attempt, err, delayMs);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
