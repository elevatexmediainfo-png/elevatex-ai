import { describe, expect, it } from "vitest";
import { assignTrackSlots } from "./track-slot-assignment";

// Real bug fixed live 2026-07-19 (see track-slot-assignment.ts's own
// header comment for the full evidence) — a fresh <video>/<audio>
// element + Web Audio graph connection on EVERY clip boundary broke that
// element's own decode clock, causing severe, sustained stutter (~88% of
// a clip's own lifetime frozen). The fix: 2 persistent elements
// ("slots") per track, reused across every clip that ever plays on it.
// This file tests assignTrackSlots — the pure algorithm that decides
// which slot a given set of active clips occupies — in isolation from
// React/the DOM, since that's where a subtle bug (stale closures, wrong
// clip's transform applied to the wrong persistent element) would
// actually live per the founder's own guardrail for this fix.

describe("assignTrackSlots", () => {
  it("no active clips -> both slots empty", () => {
    expect(assignTrackSlots([], [null, null])).toEqual([null, null]);
  });

  it("the first-ever active clip takes slot 0", () => {
    expect(assignTrackSlots(["clip-A"], [null, null])).toEqual(["clip-A", null]);
  });

  it("an ordinary mid-clip re-render (same clip still active) keeps its slot — no reassignment", () => {
    expect(assignTrackSlots(["clip-A"], ["clip-A", null])).toEqual(["clip-A", null]);
  });

  it("a sequential clip switch (A deactivates, B activates, no overlap) reuses the now-free slot 0 — never grows into slot 1 unless there's a real overlap", () => {
    expect(assignTrackSlots(["clip-B"], ["clip-A", null])).toEqual(["clip-B", null]);
  });

  it("many sequential clips in a row (dense scene-removal's exact real-world shape) all cycle through slot 0 alone — this is the core fix: at most 2 real elements EVER exist for the whole track, regardless of how many clips play", () => {
    let slots: [string | null, string | null] = [null, null];
    const clipIds = Array.from({ length: 20 }, (_, i) => `clip-${i}`);
    for (const id of clipIds) {
      slots = assignTrackSlots([id], slots);
      expect(slots).toEqual([id, null]);
    }
  });

  it("a transition overlap: clipA already owns slot 0 from before the overlap began, clipB claims slot 1 — zero transition-specific logic needed", () => {
    // Step 1: clipA alone.
    let slots = assignTrackSlots(["clip-A"], [null, null]);
    expect(slots).toEqual(["clip-A", null]);
    // Step 2: overlap begins — both active.
    slots = assignTrackSlots(["clip-A", "clip-B"], slots);
    expect(slots).toEqual(["clip-A", "clip-B"]);
    // Step 3: overlap ends — only clipB remains, and it KEEPS slot 1
    // rather than being reshuffled into slot 0.
    slots = assignTrackSlots(["clip-B"], slots);
    expect(slots).toEqual([null, "clip-B"]);
  });

  it("after a transition ends, an ordinary (non-overlapping) next clip cleanly collapses back to slot 0 alone — a now-idle slot 1 never lingers into an unrelated later clip's assignment", () => {
    let slots: [string | null, string | null] = ["clip-A", "clip-B"]; // mid-overlap
    slots = assignTrackSlots(["clip-B"], slots); // overlap ends, only B remains
    expect(slots).toEqual([null, "clip-B"]);
    slots = assignTrackSlots(["clip-C"], slots); // B deactivates, ordinary C activates — no overlap
    expect(slots).toEqual(["clip-C", null]);
  });

  it("a transition immediately following another (B lingers into a real B->C overlap) keeps clip-B in ITS existing slot rather than reshuffling it", () => {
    let slots: [string | null, string | null] = ["clip-A", "clip-B"]; // A->B mid-overlap
    slots = assignTrackSlots(["clip-B"], slots); // A->B overlap ends
    expect(slots).toEqual([null, "clip-B"]);
    slots = assignTrackSlots(["clip-B", "clip-C"], slots); // B->C overlap begins immediately
    // clip-B keeps slot 1 (rule 1 — still active); clip-C claims the
    // free slot 0, not a fresh 3rd slot.
    expect(slots).toEqual(["clip-C", "clip-B"]);
  });

  it("a real Module 9 double-transition (B overlaps A, then C overlaps B before A even finishes) never assigns the same clip id to two slots, and never silently loses a still-active clip", () => {
    let slots: [string | null, string | null] = [null, null];
    slots = assignTrackSlots(["clip-A"], slots);
    expect(slots).toEqual(["clip-A", null]);
    slots = assignTrackSlots(["clip-A", "clip-B"], slots); // A->B transition
    expect(slots).toEqual(["clip-A", "clip-B"]);
    slots = assignTrackSlots(["clip-B"], slots); // A fully gone
    expect(slots).toEqual([null, "clip-B"]);
    slots = assignTrackSlots(["clip-B", "clip-C"], slots); // B->C transition
    expect(slots).toEqual(["clip-C", "clip-B"]);
    slots = assignTrackSlots(["clip-C"], slots); // B fully gone
    expect(slots).toEqual(["clip-C", null]);
  });

  // Rapid, non-monotonic scrubbing — the founder's own guardrail #3
  // concern (stale closures, wrong clip applied to the wrong slot) would
  // most plausibly show up here: the playhead jumping backward and
  // forward across several clip boundaries in quick succession, not just
  // steady forward playback.
  it("rapid scrubbing back and forth across several clips never mixes up which slot holds which clip, and correctly reuses a slot when scrubbing back to a clip whose OTHER slot instance was never actually torn down", () => {
    let slots: [string | null, string | null] = [null, null];
    const sequence = ["clip-A", "clip-C", "clip-A", "clip-B", "clip-A", "clip-C", "clip-B"];
    const seenSlot0ForA = new Set<number>();
    for (let i = 0; i < sequence.length; i++) {
      slots = assignTrackSlots([sequence[i]], slots);
      // Invariant: the active clip is ALWAYS in exactly one slot, never
      // both, never neither.
      const inSlot0 = slots[0] === sequence[i];
      const inSlot1 = slots[1] === sequence[i];
      expect(inSlot0 || inSlot1).toBe(true);
      expect(inSlot0 && inSlot1).toBe(false);
      if (sequence[i] === "clip-A" && inSlot0) seenSlot0ForA.add(i);
    }
    // clip-A scrubbed back to 3 separate times in this sequence — every
    // one of them landed in slot 0 (the only slot ever used across this
    // whole no-overlap sequence), confirming stable, deterministic
    // single-slot reuse under scrubbing, not a fresh slot each time.
    expect(seenSlot0ForA.size).toBe(3);
  });

  it("a 3rd simultaneously-active clip (shouldn't happen — transitions cap at 2) is silently dropped rather than evicting an existing slot or crashing", () => {
    const slots = assignTrackSlots(["clip-A", "clip-B", "clip-C"], [null, null]);
    expect(slots[0]).not.toBeNull();
    expect(slots[1]).not.toBeNull();
    expect(slots).toContain("clip-A");
    expect(slots).toContain("clip-B");
    expect(slots).not.toContain("clip-C");
  });
});
