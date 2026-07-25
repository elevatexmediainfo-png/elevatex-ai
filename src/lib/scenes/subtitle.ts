// No speech-to-text provider is needed: a scene's spoken line IS its
// subtitle text (the same script segment fed to the Voice/Video providers),
// so this is a deterministic formatter, not a generation call.

function formatVttTimestamp(totalSeconds: number): string {
  const wholeSeconds = Math.floor(totalSeconds);
  const ms = Math.round((totalSeconds - wholeSeconds) * 1000);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const seconds = wholeSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${String(ms).padStart(3, "0")}`;
}

export function buildSceneSubtitleVtt(text: string, durationSeconds: number): string {
  const start = formatVttTimestamp(0);
  const end = formatVttTimestamp(Math.max(durationSeconds, 1));
  return `WEBVTT\n\n1\n${start} --> ${end}\n${text.trim()}\n`;
}

// Milestone 9 (Caption Editor) — once a scene has explicit per-word
// timestamps (CaptionWord rows), the rendered subtitle track can use them
// directly instead of one cue spanning the whole scene — one cue per word,
// still a deterministic formatter, no speech-to-text provider involved.
export interface TimedWord {
  text: string;
  startMs: number;
  endMs: number;
}

export function buildWordLevelVtt(words: TimedWord[]): string {
  const cues = words
    .map((w, i) => {
      const start = formatVttTimestamp(w.startMs / 1000);
      const end = formatVttTimestamp(Math.max(w.endMs, w.startMs + 1) / 1000);
      return `${i + 1}\n${start} --> ${end}\n${w.text}`;
    })
    .join("\n\n");
  return `WEBVTT\n\n${cues}\n`;
}
