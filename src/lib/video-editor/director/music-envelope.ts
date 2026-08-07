import type { AIMusicVolumePoint, AIStoryBeat, AIStoryBeatKind } from "@/lib/validations/ai-timeline";

// AI Video Director quality upgrade (2026-08-07, TASK 7 — "music should
// evolve"). Deliberately DETERMINISTIC, not asked of the Audio agent's own
// LLM call (see buildAudioPrompt's own doc comment) — the story beats
// already exist by the time Audio runs, so this is pure post-processing,
// zero extra reasoning cost. Maps each of the 7 story-rhythm beat kinds to
// an energy level (0-100) a real editor would mix a music bed at during
// that section — low under the hook (so the hook's own words/visuals lead,
// not the music), building through the middle, and uplifting toward the
// CTA. This is the bed's OWN energy curve; real-time speech ducking
// (EditorTrack.duckingEnabled/duckingAmountDb) still applies ON TOP of it
// unchanged — the two mechanisms are independent and compose normally.
const BEAT_ENERGY_LEVEL: Record<AIStoryBeatKind, number> = {
  hook: 40,
  curiosity: 55,
  value: 65,
  pattern_interrupt: 70,
  visual_reward: 70,
  proof: 60,
  cta: 85,
};

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

  const points: AIMusicVolumePoint[] = sorted.map((beat) => ({ atFraction: fractionOf(beat.startMs), volumeLevel: BEAT_ENERGY_LEVEL[beat.kind] }));

  const last = sorted[sorted.length - 1];
  if (fractionOf(last.endMs) < 1) {
    points.push({ atFraction: fractionOf(last.endMs), volumeLevel: BEAT_ENERGY_LEVEL[last.kind] });
  }
  return points;
}
