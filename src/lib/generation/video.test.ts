import { describe, expect, it } from "vitest";

import { filterByDurationSupport } from "./video";
import { SoraVideoProvider } from "@/lib/providers/video/sora.provider";
import { VeoVideoProvider } from "@/lib/providers/video/veo.provider";

// Real bug fix (2026-07-25) — found live: FILM's 10s scenes hit a real 400
// from Sora ("Invalid value: '10'. Supported values are: '4', '8', and
// '12'"), burning a guaranteed-fail attempt (and real latency) before
// falling through to the next provider. Tests against the REAL provider
// classes/durations each real flow actually uses, not fabricated stand-ins —
// see filterByDurationSupport's own comment for why this is a standalone
// pure function instead of only being covered by a full renderVideo() call.
describe("filterByDurationSupport", () => {
  it("excludes Sora for FILM's real 10s/20s duration options", () => {
    const sora = new SoraVideoProvider();
    const veo = new VeoVideoProvider();

    expect(filterByDurationSupport([sora, veo], 10)).toEqual([veo]);
    expect(filterByDurationSupport([sora, veo], 20)).toEqual([veo]);
  });

  it("keeps Sora for Quick Video's real fixed 8-second duration", () => {
    const sora = new SoraVideoProvider();
    const veo = new VeoVideoProvider();

    expect(filterByDurationSupport([sora, veo], 8)).toEqual([sora, veo]);
  });

  it("keeps Sora for its own other real supported durations (4, 12)", () => {
    const sora = new SoraVideoProvider();

    expect(filterByDurationSupport([sora], 4)).toEqual([sora]);
    expect(filterByDurationSupport([sora], 12)).toEqual([sora]);
  });

  it("never restricts a provider with no declared duration constraint (the common case)", () => {
    const veo = new VeoVideoProvider();

    // Veo declares no supportedDurationsSeconds — must remain eligible for
    // any requested duration, including ones no real flow in this app uses.
    expect(filterByDurationSupport([veo], 1)).toEqual([veo]);
    expect(filterByDurationSupport([veo], 999)).toEqual([veo]);
  });
});
