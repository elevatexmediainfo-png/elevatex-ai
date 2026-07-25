// Shared by every adapter that wraps a vendor's create-then-poll async job
// API (Replicate/Flux already had this shape; Milestone 10 adds four more
// video vendors with the same control flow) — only the per-vendor status
// check differs, so that's the one thing each call site supplies.
export interface PollCheckResult<T> {
  status: "pending" | "succeeded" | "failed";
  data?: T;
  error?: string;
}

export async function pollUntilSettled<T>(
  checkStatus: () => Promise<PollCheckResult<T>>,
  options: { intervalMs: number; maxAttempts: number; label: string }
): Promise<T> {
  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, options.intervalMs));

    const result = await checkStatus();
    if (result.status === "succeeded") {
      if (result.data === undefined) {
        throw new Error(`${options.label} succeeded but returned no data.`);
      }
      return result.data;
    }
    if (result.status === "failed") {
      throw new Error(`${options.label} failed: ${result.error ?? "no error detail"}`);
    }
    // status is "pending" — keep polling.
  }

  throw new Error(`${options.label} timed out waiting for completion.`);
}
