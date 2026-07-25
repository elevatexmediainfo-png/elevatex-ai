import { describe, expect, it } from "vitest";

import { buildSceneSubtitleVtt } from "./subtitle";

describe("buildSceneSubtitleVtt", () => {
  it("produces a valid single-cue WebVTT document", () => {
    const vtt = buildSceneSubtitleVtt("Hello world", 5);
    expect(vtt.startsWith("WEBVTT\n\n")).toBe(true);
    expect(vtt).toContain("00:00:00.000 --> 00:00:05.000");
    expect(vtt).toContain("Hello world");
  });

  it("formats minutes/hours correctly for long durations", () => {
    const vtt = buildSceneSubtitleVtt("Long scene", 3725); // 1h 2m 5s
    expect(vtt).toContain("--> 01:02:05.000");
  });

  it("trims the subtitle text", () => {
    const vtt = buildSceneSubtitleVtt("  padded text  ", 2);
    expect(vtt).toContain("padded text\n");
    expect(vtt).not.toContain("  padded text");
  });

  it("floors duration at 1 second to avoid a zero-length cue", () => {
    const vtt = buildSceneSubtitleVtt("Tiny", 0);
    expect(vtt).toContain("00:00:00.000 --> 00:00:01.000");
  });
});
