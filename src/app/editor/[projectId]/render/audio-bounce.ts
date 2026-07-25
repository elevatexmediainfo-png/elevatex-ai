import {
  computeDuckingMultiplier,
  computeFadeMultiplier,
  DEFAULT_AUDIO_PROPERTIES,
  isTrackAudible,
  pitchToPlaybackRateMultiplier,
  resolveVolume,
  type DuckingVoiceInterval,
} from "@/lib/video-editor/audio";
import { resolveAudioTransitionGain } from "@/lib/video-editor/transition-engine";
import type { Keyframeable } from "@/lib/video-editor/transform";
import { clipEndMs, type AssetView, type ClipView, type TrackView, type TransitionView } from "../../types";

// Module 10 — bounces the project's full audio mix to a WAV file using an
// OfflineAudioContext (faster-than-real-time rendering, only available in a
// browser — this is why this file is only ever called from inside the
// render-mode page, not from the Node.js export worker directly). Reuses
// resolveVolume/computeFadeMultiplier/pitchToPlaybackRateMultiplier/
// isTrackAudible/resolveAudioTransitionGain/computeDuckingMultiplier — the
// EXACT SAME pure functions compositor-stage.tsx's AudioLayer already uses
// for live playback — rather than re-deriving volume/pan/pitch/ducking
// math for the export path (the brief's explicit instruction). Only the
// ORCHESTRATION (decode files, schedule
// buffer sources, sample continuous curves into Web-Audio-native automation
// points) is new here, because OfflineAudioContext has no "evaluate this
// every frame" live render loop to hook into the way the DOM compositor
// does — it needs the whole gain curve up front as an array of numbers.
//
// Known, documented limitation: `AudioBufferSourceNode.playbackRate` (the
// only speed control an OfflineAudioContext source has) always shifts
// pitch — there is no offline equivalent of a live <audio>/<video>
// element's `preservesPitch=true` (native time-stretch). So a clip with a
// non-default SPEED and UNTOUCHED pitch, which correctly preserves pitch
// in the live preview, will have its pitch shift slightly in the bounced
// export audio. This is a narrow, honestly-flagged edge case — every other
// audio property (volume, fades, pan, transition crossfades, mute/solo,
// actual timing) bounces exactly — see PROJECT_STATUS.md's Module 10 entry.

const SAMPLE_RATE = 44100;
const GAIN_CURVE_HZ = 50; // 20ms resolution — well below audible fade granularity.

interface BounceInput {
  tracks: TrackView[];
  clips: ClipView[];
  transitions: TransitionView[];
  assetById: Map<string, AssetView>;
  totalDurationMs: number;
}

export async function bounceAudioToWav(input: BounceInput): Promise<Blob> {
  const totalSamples = Math.max(1, Math.ceil((input.totalDurationMs / 1000) * SAMPLE_RATE));
  const ctx = new OfflineAudioContext(2, totalSamples, SAMPLE_RATE);
  const anyTrackSoloed = input.tracks.some((t) => t.soloed);
  const voiceIntervalsByTrackId = resolveVoiceIntervalsByTrackId(input.tracks, input.clips, anyTrackSoloed);

  const bufferCache = new Map<string, AudioBuffer | null>();
  async function getBuffer(url: string): Promise<AudioBuffer | null> {
    if (bufferCache.has(url)) return bufferCache.get(url)!;
    let result: AudioBuffer | null = null;
    try {
      const arrayBuffer = await fetch(url).then((r) => r.arrayBuffer());
      result = await ctx.decodeAudioData(arrayBuffer);
    } catch {
      // A VIDEO asset with no audio track, or an undecodable file — treated
      // as silent, matching how a live <video> with no audio track just
      // plays without sound rather than erroring.
      result = null;
    }
    bufferCache.set(url, result);
    return result;
  }

  const audioBearingClips = input.clips.filter((c) => {
    const track = input.tracks.find((t) => t.id === c.trackId);
    return Boolean(track && (track.kind === "AUDIO" || track.kind === "VIDEO") && c.assetId);
  });

  for (const clip of audioBearingClips) {
    const track = input.tracks.find((t) => t.id === clip.trackId)!;
    if (!isTrackAudible(track, anyTrackSoloed)) continue; // fully silent — skip scheduling entirely.

    const asset = input.assetById.get(clip.assetId!);
    if (!asset) continue;
    const buffer = await getBuffer(asset.url);
    if (!buffer) continue;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gainNode = ctx.createGain();
    const pannerNode = ctx.createStereoPanner();
    source.connect(gainNode).connect(pannerNode).connect(ctx.destination);

    if (track.kind === "AUDIO") {
      const content = clip.content ?? {};
      const volume = content.volume ?? DEFAULT_AUDIO_PROPERTIES.volume;
      const fadeInMs = content.fadeInMs ?? DEFAULT_AUDIO_PROPERTIES.fadeInMs;
      const fadeOutMs = content.fadeOutMs ?? DEFAULT_AUDIO_PROPERTIES.fadeOutMs;
      const pan = content.pan ?? DEFAULT_AUDIO_PROPERTIES.pan;
      const pitchSemitones = content.pitchSemitones ?? DEFAULT_AUDIO_PROPERTIES.pitchSemitones;
      const speed = content.speed ?? DEFAULT_AUDIO_PROPERTIES.speed;

      source.playbackRate.value = speed * (pitchSemitones !== 0 ? pitchToPlaybackRateMultiplier(pitchSemitones) : 1);
      pannerNode.pan.value = pan;

      const curve = sampleGainCurve(clip, track, input.transitions, volume, fadeInMs, fadeOutMs, voiceIntervalsByTrackId.get(track.id) ?? null);
      gainNode.gain.setValueCurveAtTime(curve, clip.startMs / 1000, Math.max(1 / SAMPLE_RATE, clip.durationMs / 1000));
    } else {
      // VIDEO track's embedded audio — no per-clip volume/pan/fade exists
      // for this in the app (AudioLayer's VideoLayer counterpart always
      // uses {volume:1, pan:0}), so this mirrors that exactly: ambient
      // volume, center pan, only mute/solo applies (already handled above
      // by skipping inaudible clips entirely).
      gainNode.gain.value = 1;
      pannerNode.pan.value = 0;
    }

    const whenSeconds = clip.startMs / 1000;
    const offsetSeconds = clip.trimStartMs / 1000;
    const durationSeconds = clip.durationMs / 1000;
    try {
      source.start(whenSeconds, offsetSeconds, durationSeconds);
    } catch {
      // A clip whose trim offset exceeds the decoded buffer's own length
      // (e.g. a mismatched/corrupt source) — skip it rather than aborting
      // the whole bounce over one bad clip.
    }
  }

  const rendered = await ctx.startRendering();
  return audioBufferToWavBlob(rendered);
}

// Audio Ducking — for every AUDIO track with ducking enabled, resolves its
// target voice-clip windows once per bounce (not per-sample — the input
// clip list is already the full, final project state for this render, so
// there's no "goes stale" risk the way a live, still-editable timeline
// has). Exact same target-resolution rule as compositor-stage.tsx's own
// per-render memo: an explicit duckingVoiceTrackIds list if set, else
// every audioSubtype=VOICE track; only clips on AUDIBLE (mute/solo-aware)
// voice tracks count.
function resolveVoiceIntervalsByTrackId(tracks: TrackView[], clips: ClipView[], anyTrackSoloed: boolean): Map<string, DuckingVoiceInterval[]> {
  const map = new Map<string, DuckingVoiceInterval[]>();
  for (const track of tracks) {
    if (track.kind !== "AUDIO" || !track.duckingEnabled) continue;
    const targetVoiceTrackIds =
      track.duckingVoiceTrackIds.length > 0 ? track.duckingVoiceTrackIds : tracks.filter((t) => t.audioSubtype === "VOICE").map((t) => t.id);
    const audibleVoiceTrackIds = new Set(
      targetVoiceTrackIds.filter((id) => {
        const voiceTrack = tracks.find((t) => t.id === id);
        return voiceTrack ? isTrackAudible(voiceTrack, anyTrackSoloed) : false;
      })
    );
    const intervals = clips.filter((c) => audibleVoiceTrackIds.has(c.trackId) && c.assetId).map((c) => ({ startMs: c.startMs, endMs: clipEndMs(c) }));
    map.set(track.id, intervals);
  }
  return map;
}

// Pure — samples the clip's own volume*fade curve, layering in a
// transition crossfade multiplier when this clip's playback window
// overlaps one it participates in (as either side), and a ducking
// multiplier when this track has ducking enabled — reuses
// resolveVolume/computeFadeMultiplier/resolveAudioTransitionGain/
// computeDuckingMultiplier exactly, only the SAMPLING loop (needed to
// build a Web-Audio-native automation curve) is new.
function sampleGainCurve(
  clip: ClipView,
  track: TrackView,
  transitions: TransitionView[],
  volume: Keyframeable<number>,
  fadeInMs: number,
  fadeOutMs: number,
  voiceIntervals: DuckingVoiceInterval[] | null
): Float32Array {
  const durationSec = clip.durationMs / 1000;
  const sampleCount = Math.max(2, Math.ceil(durationSec * GAIN_CURVE_HZ) + 1);
  const curve = new Float32Array(sampleCount);

  const transitionAsA = transitions.find((t) => t.trackId === track.id && t.clipAId === clip.id);
  const transitionAsB = transitions.find((t) => t.trackId === track.id && t.clipBId === clip.id);

  for (let i = 0; i < sampleCount; i++) {
    const atMs = Math.min(clip.durationMs, (i / (sampleCount - 1)) * clip.durationMs);
    const absoluteMs = clip.startMs + atMs;
    let v = resolveVolume(volume, atMs) * computeFadeMultiplier(atMs, clip.durationMs, fadeInMs, fadeOutMs);

    if (transitionAsA) {
      const overlapStart = clip.startMs + clip.durationMs - transitionAsA.durationMs;
      if (absoluteMs >= overlapStart) {
        const t = (absoluteMs - overlapStart) / transitionAsA.durationMs;
        v *= resolveAudioTransitionGain(transitionAsA.easing, t).gainA;
      }
    }
    if (transitionAsB) {
      const overlapEnd = clip.startMs + transitionAsB.durationMs;
      if (absoluteMs < overlapEnd) {
        const t = (absoluteMs - clip.startMs) / transitionAsB.durationMs;
        v *= resolveAudioTransitionGain(transitionAsB.easing, t).gainB;
      }
    }
    if (voiceIntervals) {
      v *= computeDuckingMultiplier(absoluteMs, voiceIntervals, track.duckingAmountDb, track.duckingFadeMs);
    }
    curve[i] = Math.max(0, v);
  }
  return curve;
}

// Standard 16-bit PCM WAV encoding — hand-written rather than a dependency,
// since this is the one, well-understood place it's needed (encoding an
// already-rendered AudioBuffer into a RIFF/WAVE container).
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, s: string) {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channelData.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}
