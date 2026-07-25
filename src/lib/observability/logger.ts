import pino from "pino";
import pretty from "pino-pretty";

// Milestone 12 — structured, leveled, JSON-output logging. Replaces raw
// console.log/console.error call sites in the queue worker, render
// pipeline, and Generation Engine with calls carrying consistent context
// (requestId/jobId/category) instead of ad-hoc string interpolation —
// mechanical, same call sites, no behavior change. Pretty-printed in dev
// (NODE_ENV !== "production") for readability, raw JSON in production for
// log aggregators to parse.
//
// pino's own `transport: { target: "pino-pretty" }` spawns pino-pretty in a
// worker thread, resolving the thread's own module path at runtime — that
// resolution breaks once Next.js's bundler (Turbopack/webpack) rewrites
// require paths, so the worker silently dies and every dev-mode log line is
// dropped. Passing a `pino-pretty` stream instance directly (in-process, no
// worker thread) avoids that resolution entirely.
export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    base: { instance: process.env.INSTANCE_ID ?? process.pid },
  },
  process.env.NODE_ENV !== "production"
    ? pretty({ colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" })
    : undefined
);

export type Logger = typeof logger;
