import type { AIMusicVolumePoint, AIStoryBeat, AIStoryBeatKind } from "@/lib/validations/ai-timeline";

// AI Video Director quality upgrade (2026-08-07, TASK 7 — "music should
// evolve"). Deliberately DETERMINISTIC, not asked of the Audio agent's own
// LLM call (see buildAudioPrompt's own doc comment) — the story beats
// already exist by the time Audio runs, so this is pure post-processing,
// zero extra reasoning cost. Maps each of the 7 story-rhythm beat kinds to
// an energy level (0-100) a real editor would mix a music bed at during
// that section. This is the bed's OWN energy curve; real-time speech
// ducking (EditorTrack.duckingEnabled/duckingAmountDb) still applies ON
// TOP of it unchanged — the two mechanisms are independent and compose
// normally.
//
// Polish pass (2026-08-07, "music should behave like a real editor —
// build, release, pause, rise again — never remain flat") — this is
// deliberately NOT a monotonic staircase up to the CTA (the original
// version was: hook 40 -> curiosity 55 -> value 65 -> pattern_interrupt
// 70 -> visual_reward 70 -> proof 60 -> cta 85, which only ever climbed
// or gently eased, never actually pulled back). A real editor's biggest
// lever for "pattern_interrupt" — a genuine shift in energy/topic that
// resets attention — is specifically to DROP or PAUSE the music right
// there, creating the silence/contrast that makes the interrupt land;
// "visual_reward" then RISES out of that pause as the payoff. "proof"
// deliberately settles back down too — evidence reads as more credible
// under a quieter bed, not a loud one. The result is a real contour:
// low -> build -> PAUSE -> RISE -> release -> uplifting close.
const BEAT_ENERGY_LEVEL: Record<AIStoryBeatKind, number> = {
  hook: 35,
  curiosity: 50,
  value: 60,
  pattern_interrupt: 25, // the "pause" — a real editor drops the bed here
  visual_reward: 75, // the "rise again" — payoff after the pause
  proof: 55, // the "release" — settles back, lets the evidence speak
  cta: 85,
};

// Repeated beats of the SAME kind (e.g. several "value" beats in a row,
// common in a longer video) would otherwise all sit at the identical
// level — a real flat stretch, exactly what "never remain flat" rules
// out. A small deterministic oscillation (+/-6, alternating by the
// beat's own position among same-kind repeats) keeps a long run of the
// same beat kind subtly alive without ever contradicting the kind's own
// base character (a "value" beat never gets loud enough to read as a
// "cta," it just breathes a little).
const REPEAT_OSCILLATION = 6;

// One (atFraction, volumeLevel) point per beat's own start (as a fraction
// of sourceDurationMs — see aiMusicVolumePointSchema's own doc comment
// for why a fraction, not an absolute ms, is the right unit here), plus a
// final point holding the last beat's level through to the end (so the
// envelope always covers the whole video, never leaving a trailing
// stretch with no defined level). Empty beats -> empty envelope
// (translateMusic, ai-timeline-translator.ts, falls back to a flat,
// unchanging volume when this is empty — today's pre-existing behavior).
export function buildMusicVolumeEnvelope(beats: AIStoryBeat[], sourceDurationMs: number): AIMusicVolumePoint[] {
  if (beats.length === 0 || sourceDurationMs <= 0) return [];
  const sorted = [...beats].sort((a, b) => a.startMs - b.startMs);
  const fractionOf = (ms: number) => Math.max(0, Math.min(1, ms / sourceDurationMs));

  const seenOfKind = new Map<AIStoryBeatKind, number>();
  const levelFor = (kind: AIStoryBeatKind): number => {
    const base = BEAT_ENERGY_LEVEL[kind];
    const occurrence = seenOfKind.get(kind) ?? 0;
    seenOfKind.set(kind, occurrence + 1);
    if (occurrence === 0) return base;
    // Alternate down/up around the base level for each repeat beyond the first.
    const direction = occurrence % 2 === 1 ? -1 : 1;
    return Math.max(0, Math.min(100, base + direction * REPEAT_OSCILLATION));
  };

  const points: AIMusicVolumePoint[] = sorted.map((beat) => ({ atFraction: fractionOf(beat.startMs), volumeLevel: levelFor(beat.kind) }));

  const last = sorted[sorted.length - 1];
  if (fractionOf(last.endMs) < 1) {
    points.push({ atFraction: fractionOf(last.endMs), volumeLevel: points[points.length - 1].volumeLevel });
  }
  return points;
}
