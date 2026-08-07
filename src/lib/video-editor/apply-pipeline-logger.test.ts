import { afterEach, describe, expect, it, vi } from "vitest";

import { APPLY_STAGES, AI_EDIT_MODULES, describeThrown, logApplyFailure, logApplyStage } from "./apply-pipeline-logger";

describe("apply-pipeline-logger (requirement 4, Apply pipeline instrumentation)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("APPLY_STAGES matches the founder's own requested diagram, in order", () => {
    expect(APPLY_STAGES).toEqual(["timeline_generated", "timeline_translated", "command_created", "command_executed", "command_applied", "saved", "rendered"]);
  });

  it("AI_EDIT_MODULES covers every independently-run apply module", () => {
    expect(AI_EDIT_MODULES).toEqual(["sceneRemoval", "captions", "overlay", "zoom", "sfx", "music", "transitions"]);
  });

  it("logApplyStage returns a structured event with a real timestamp and emits to console.info", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const event = logApplyStage({ stage: "command_applied", module: "captions", jobId: "job-1", detail: { count: 4 } });

    expect(event.stage).toBe("command_applied");
    expect(event.module).toBe("captions");
    expect(event.jobId).toBe("job-1");
    expect(event.detail).toEqual({ count: 4 });
    expect(typeof event.timestamp).toBe("string");
    expect(() => new Date(event.timestamp)).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("logApplyFailure returns a structured event carrying Module/Reason/Stack/Affected clips/Rollback result and emits to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const event = logApplyFailure({
      module: "overlay",
      reason: "Simulated transient failure",
      stack: "Error: Simulated transient failure\n  at somewhere",
      affectedClipIds: ["clip-1", "clip-2"],
      rollbackResult: "rolled_back",
      jobId: "job-1",
    });

    expect(event.module).toBe("overlay");
    expect(event.reason).toBe("Simulated transient failure");
    expect(event.stack).toContain("Simulated transient failure");
    expect(event.affectedClipIds).toEqual(["clip-1", "clip-2"]);
    expect(event.rollbackResult).toBe("rolled_back");
    expect(typeof event.timestamp).toBe("string");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("describeThrown extracts message + stack from a real Error", () => {
    const err = new Error("boom");
    const { reason, stack } = describeThrown(err);
    expect(reason).toBe("boom");
    expect(stack).toContain("boom");
  });

  it("describeThrown falls back to a safe string for a non-Error throw", () => {
    expect(describeThrown("plain string throw")).toEqual({ reason: "plain string throw" });
    expect(describeThrown({ weird: "object" })).toEqual({ reason: "Unknown error" });
  });
});
