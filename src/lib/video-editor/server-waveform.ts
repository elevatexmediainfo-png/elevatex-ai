import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runFfmpeg } from "./ffmpeg-exec";
import { computePeaksFromChannelData } from "./audio";

// Milestone 26 — Admin Asset Library's server-side waveform precompute.
// Module 8's computePeaksFromChannelData() is a pure function over decoded
// Float32Array channel data — it was always portable, only its ONE caller
// (the browser upload flow) was tied to Web Audio's decodeAudioData, which
// doesn't exist in a server-side bulk-upload request. This decodes via the
// same ffmpeg binary/wrapper already used for video frame extraction
// (runFfmpeg, ffmpeg-exec.ts) instead, then feeds the result into the exact
// same bucket-averaging function unchanged — the waveform MATH is 100%
// reused, only the decode step is new.
const SAMPLE_RATE = 44100;

export async function decodeAudioToPeaks(audioBuffer: Buffer): Promise<number[]> {
  const tempDir = await mkdtemp(join(tmpdir(), "audio-waveform-"));
  try {
    const inputPath = join(tempDir, "input.audio");
    const outputPath = join(tempDir, "pcm.f32le");
    await writeFile(inputPath, audioBuffer);
    // Mono, 32-bit float, little-endian raw PCM — the simplest format to
    // parse back into a Float32Array with zero container/header parsing.
    await runFfmpeg(["-y", "-i", inputPath, "-f", "f32le", "-ac", "1", "-ar", String(SAMPLE_RATE), outputPath]);

    const pcm = await readFile(outputPath);
    const channelData = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 4));
    return computePeaksFromChannelData([channelData]);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
