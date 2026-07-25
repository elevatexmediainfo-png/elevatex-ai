// Audio Engine (Module 8) — pure types + math, framework-agnostic (no DOM/
// Web Audio API calls here — those live in preview-window.tsx and the
// upload-time peak-generation helper), mirroring transform.ts/text-style.ts's
// "pure math, safely importable by a future server-side export compositor"
// convention.
//
// Design decision — volume alone is `Keyframeable<number>`, everything else
// (pan/fade/pitch/speed) is a plain value: the brief explicitly deferred
// audio keyframing ("should be keyframeable later... use your judgment").
// `Keyframeable<number>` costs nothing extra today — `resolveTransformValue`
// and `lerpValue` (transform.ts) already handle plain numbers with zero
// changes — and this is the EXACT choice Module 4 made for `ClipTransform`
// before Module 6 activated keyframing: ship the `{value, keyframes}` shape
// now so a future module can add keyframe-editing UI with zero data
// migration, but don't build that UI now since it wasn't asked for this
// module. Pan/pitch/speed don't get this treatment since keyframing THOSE
// was never mentioned at all — adding it would be unrequested scope.
//
// Where these fields live: `ClipContent` (Module 7's "type-specific
// payload" convention), not a new `clip.audio` column — audio properties
// are exactly as clip-kind-specific as Module 7's text-style fields were,
// so they follow the same precedent rather than inventing a third JSON
// column alongside `content`/`transform`.

import { resolveTransformValue, type Keyframeable } from "./transform";

export interface AudioProperties {
  volume: Keyframeable<number>; // 0..2 (100 = unity gain in the UI's 0-200% slider; stored 0..2 here)
  pan: number; // -1 (full left) .. 1 (full right), 0 = center
  fadeInMs: number;
  fadeOutMs: number;
  pitchSemitones: number; // -12..12
  speed: number; // 0.25..4, 1 = normal
}

export const DEFAULT_AUDIO_PROPERTIES: AudioProperties = {
  volume: { value: 1, keyframes: null },
  pan: 0,
  fadeInMs: 0,
  fadeOutMs: 0,
  pitchSemitones: 0,
  speed: 1,
};

export function resolveVolume(volume: Keyframeable<number>, atMs: number): number {
  return resolveTransformValue(volume, atMs);
}

// Fade is NOT a keyframe track — it's a fixed shape (linear ramp in over
// fadeInMs from clip start, linear ramp out over fadeOutMs into clip end)
// driven by the clip's own duration, matching how trim/split already treat
// clip-relative time as the source of truth. Returns a 0..1 multiplier to
// apply on top of the resolved volume. `atMs` is clip-relative (0 = this
// clip's own start, matching Module 6's keyframe timeMs convention).
export function computeFadeMultiplier(atMs: number, durationMs: number, fadeInMs: number, fadeOutMs: number): number {
  if (durationMs <= 0) return 1;
  let multiplier = 1;
  if (fadeInMs > 0 && atMs < fadeInMs) {
    multiplier = Math.min(multiplier, Math.max(0, atMs / fadeInMs));
  }
  const fadeOutStart = durationMs - fadeOutMs;
  if (fadeOutMs > 0 && atMs > fadeOutStart) {
    multiplier = Math.min(multiplier, Math.max(0, (durationMs - atMs) / fadeOutMs));
  }
  return multiplier;
}

// Standard DAW solo convention (Part C): while ANY track in the project is
// soloed, every non-soloed track is silent regardless of its own isMuted;
// a track's own isMuted still applies on top of that. Pure so both the
// live compositor and a future export pass can share it.
export function isTrackAudible(track: { isMuted: boolean; soloed: boolean }, anyTrackSoloed: boolean): boolean {
  if (track.isMuted) return false;
  if (anyTrackSoloed && !track.soloed) return false;
  return true;
}

export function pitchToPlaybackRateMultiplier(pitchSemitones: number): number {
  return Math.pow(2, pitchSemitones / 12);
}

// ---------------------------------------------------------------------
// Audio Ducking
// ---------------------------------------------------------------------

// A voice clip's absolute (project-timeline, not clip-relative) on-screen
// window — the only shape computeDuckingMultiplier needs from a clip,
// deliberately not the full ClipView so this stays as framework/schema-
// agnostic as the rest of this file.
export interface DuckingVoiceInterval {
  startMs: number;
  endMs: number;
}

// Pure — computes a 0..1 gain multiplier for a MUSIC/SFX track at a given
// absolute timeline position, given the set of voice intervals it should
// duck under. Deliberately takes already-resolved intervals rather than
// clip/track objects: the caller (live compositor render loop, or the
// export bounce's curve sampler) is responsible for deriving the CURRENT
// voice-clip windows from the live clip list every time this is called —
// this function itself is stateless and holds nothing that could go stale
// if a voice clip later moves.
//
// Shape: each voice interval contributes a trapezoid — ramps 0->1 over
// `fadeMs` before its start, holds 1 for its full duration, ramps 1->0
// over `fadeMs` after its end (attack and release share one duration, see
// the schema's own doc comment for why). Overlapping/adjacent voice
// intervals aren't summed (which could over-duck below the configured
// floor) — the loudest applicable "how ducked should we be right now"
// wins via Math.max, then that single activation amount is used to
// interpolate between full volume (1) and the configured ducked floor.
export function computeDuckingMultiplier(
  atMs: number,
  voiceIntervals: DuckingVoiceInterval[],
  duckAmountDb: number,
  fadeMs: number
): number {
  if (voiceIntervals.length === 0 || duckAmountDb === 0) return 1;
  const duckedFloor = Math.pow(10, duckAmountDb / 20); // dB -> linear gain, e.g. -12dB -> ~0.251
  let activation = 0;
  for (const { startMs, endMs } of voiceIntervals) {
    let a: number;
    if (atMs >= startMs && atMs <= endMs) {
      a = 1;
    } else if (fadeMs > 0 && atMs < startMs && atMs >= startMs - fadeMs) {
      a = (atMs - (startMs - fadeMs)) / fadeMs; // attack ramp
    } else if (fadeMs > 0 && atMs > endMs && atMs <= endMs + fadeMs) {
      a = 1 - (atMs - endMs) / fadeMs; // release ramp
    } else {
      a = 0;
    }
    activation = Math.max(activation, a);
  }
  if (activation <= 0) return 1;
  return 1 - activation * (1 - duckedFloor);
}

// ---------------------------------------------------------------------
// Waveform peaks
// ---------------------------------------------------------------------

// Fixed bucket count for the FULL source file, computed once at upload
// time and stored on EditorAsset — high enough resolution that slicing a
// short trimmed window still has enough buckets to look like a real
// waveform, low enough to keep the stored JSON small (2000 floats is a
// tiny payload compared to the audio file itself).
export const WAVEFORM_PEAK_BUCKETS = 2000;

// Downsamples a decoded audio buffer's channel data into WAVEFORM_PEAK_BUCKETS
// peak amplitudes (0..1, the max absolute sample per bucket, channels
// averaged). Pure function over plain arrays (not AudioBuffer) so it's
// unit-testable without a real Web Audio API / jsdom AudioContext — the
// caller (upload flow) is responsible for the actual decodeAudioData call
// and passing in `channelData` (one Float32Array per channel).
export function computePeaksFromChannelData(channelData: Float32Array[], bucketCount = WAVEFORM_PEAK_BUCKETS): number[] {
  if (channelData.length === 0 || channelData[0].length === 0) return new Array(bucketCount).fill(0);
  const length = channelData[0].length;
  const samplesPerBucket = Math.max(1, Math.floor(length / bucketCount));
  const peaks: number[] = [];
  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const start = bucket * samplesPerBucket;
    const end = bucket === bucketCount - 1 ? length : Math.min(length, start + samplesPerBucket);
    let max = 0;
    for (let i = start; i < end; i++) {
      let sampleSum = 0;
      for (const channel of channelData) sampleSum += Math.abs(channel[i] ?? 0);
      max = Math.max(max, sampleSum / channelData.length);
    }
    peaks.push(Math.min(1, max));
  }
  return peaks;
}

// Slices the full-file peaks array down to the sub-range a clip's trim
// window actually shows, in bucket-index space — so ClipBlock's <canvas>
// only ever draws the visible slice, per the brief ("waveform must
// visually reflect trim in/out points"). `sourceDurationMs` is the
// asset's own full duration (for mapping ms -> bucket index);
// `trimStartMs`/`visibleDurationMs` are the clip's own trim window.
export function sliceWaveformPeaks(
  peaks: number[],
  sourceDurationMs: number,
  trimStartMs: number,
  visibleDurationMs: number
): number[] {
  if (peaks.length === 0 || sourceDurationMs <= 0) return [];
  const startFrac = Math.max(0, Math.min(1, trimStartMs / sourceDurationMs));
  const endFrac = Math.max(0, Math.min(1, (trimStartMs + visibleDurationMs) / sourceDurationMs));
  const startIndex = Math.floor(startFrac * peaks.length);
  const endIndex = Math.max(startIndex + 1, Math.ceil(endFrac * peaks.length));
  return peaks.slice(startIndex, endIndex);
}
