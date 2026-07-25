import type { GenerationRequest, GenerationResult } from "./types";

// Phase 15 — In-memory generation queue.
// Manages concurrency and priority for generation requests.
// Production replacement: Redis-backed queue, but this in-memory version
// is sufficient for Phase 15 and handles the typical single-server use case.

export type QueuePriority = "high" | "normal" | "low";

interface QueueEntry {
  request:    GenerationRequest;
  priority:   QueuePriority;
  addedAt:    number;
  resolve:    (result: GenerationResult) => void;
  reject:     (error: unknown) => void;
}

export interface QueueConfig {
  maxConcurrency: number;   // how many parallel generations
  maxQueueSize:   number;   // maximum pending requests
}

export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxConcurrency: 3,
  maxQueueSize:   50,
};

/** Simple in-memory priority queue for generation requests. */
export class GenerationQueue {
  private queue: QueueEntry[] = [];
  private activeCount = 0;
  private readonly config: QueueConfig;
  private executor: ((request: GenerationRequest) => Promise<GenerationResult>) | null = null;

  constructor(config: QueueConfig = DEFAULT_QUEUE_CONFIG) {
    this.config = config;
  }

  /** Register the generation executor function. */
  setExecutor(fn: (request: GenerationRequest) => Promise<GenerationResult>) {
    this.executor = fn;
  }

  /** Enqueue a generation request. Returns a promise that resolves with the result. */
  enqueue(request: GenerationRequest, priority: QueuePriority = "normal"): Promise<GenerationResult> {
    if (this.queue.length >= this.config.maxQueueSize) {
      return Promise.reject(new Error(`Generation queue is full (${this.config.maxQueueSize} pending requests)`));
    }

    return new Promise((resolve, reject) => {
      const entry: QueueEntry = { request, priority, addedAt: Date.now(), resolve, reject };
      // Priority ordering: high first, then by arrival time
      const insertAt = priority === "high"
        ? this.queue.findIndex(e => e.priority !== "high")
        : priority === "normal"
        ? this.queue.findIndex(e => e.priority === "low")
        : this.queue.length;
      this.queue.splice(insertAt === -1 ? this.queue.length : insertAt, 0, entry);
      this.processNext();
    });
  }

  /** Current queue depth. */
  get depth(): number { return this.queue.length; }

  /** Currently active generations. */
  get active(): number { return this.activeCount; }

  private processNext() {
    if (!this.executor) return;
    while (this.activeCount < this.config.maxConcurrency && this.queue.length > 0) {
      const entry = this.queue.shift()!;
      this.activeCount++;
      this.executor(entry.request)
        .then(entry.resolve)
        .catch(entry.reject)
        .finally(() => {
          this.activeCount--;
          this.processNext();
        });
    }
  }
}

/** Global default queue instance. */
export const defaultQueue = new GenerationQueue();
