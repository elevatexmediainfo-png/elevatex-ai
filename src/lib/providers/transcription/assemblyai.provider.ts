import type { ProviderRuntimeConfig } from "../credentials";
import type { TranscriptionRequest, TranscriptionResult, TranscriptionProvider } from "./types";

// Real adapter — AssemblyAI's async pre-recorded transcription REST API.
// Chosen over OpenAI Whisper (2026-07-12 provider review) because it's the
// only option that natively satisfies BOTH hard requirements at once:
// word-level timestamps (this pipeline's detectSilenceGaps() depends on
// them) AND documented Hindi/Hinglish mid-sentence code-switching, without
// depending on whisper-1 (on OpenAI's retirement schedule, and its
// replacements gpt-4o-transcribe/mini drop word timestamps entirely).
//
// [Localhost-unreachable fix, 2026-07-12] AssemblyAI's /v2/transcript
// accepts a plain audio_url, and it fetches that URL from ITS OWN servers —
// not ours. On local dev (MockStorageProvider), req.audioUrl resolves to
// http://localhost:3000/uploads/..., which is only reachable from this
// machine; AssemblyAI's cloud can never reach it, so passing it straight
// through would fail every single real attempt here, confirmed by a live
// incident (a Talking Head project silently kept falling back to mock even
// after the provider was enabled, until this was traced to exactly this).
// Fixed by uploading the audio bytes to AssemblyAI's own /v2/upload first
// (same "fetch from our storage, forward to vendor" shape the OpenAI
// Whisper adapter already uses — that fetch is server-to-server and has no
// reachability problem either way) and passing back ITS returned upload_url
// as audio_url instead of ours. This is strictly more robust in production
// too (S3 URLs are reachable, but this removes the dependency entirely
// rather than relying on it), so there's no reason to special-case dev vs
// prod here.
//
// Submission is async: POST creates a queued job, then we poll GET until
// status is "completed" or "error".
//
// language_detection:true (Universal-3.5 Pro, the current default async
// model) natively handles Hindi/English code-switching without a manual
// language_code — see AssemblyAI's code-switching docs, confirmed live
// 2026-07-12. A specific language hint is passed as language_code instead
// when the caller already knows the language (mirrors the EN-only case
// pipeline.ts already special-cases for Whisper).
const POLL_INTERVAL_MS = 3000;
// [Timeout regression fix, 2026-07-13] A real incident: a genuine 176.5MB/
// 67.6s video's transcription reliably failed with "Timed out after
// 300000ms" — the Generation Engine's category-wide timeout
// (GENERATION_TIMEOUT_MS_TRANSCRIPTION, 5 min default) wraps this whole
// method, including OUR OWN upload of the full file to AssemblyAI's
// /v2/upload over real internet bandwidth (the actual bottleneck — the two
// runs that DID succeed were both against a since-fixed, accidentally
// truncated 10MB file that uploaded almost instantly). Raised the
// assemblyai ProviderConfig row's own timeoutMs override to 30 minutes
// (unlike the category-wide config, per-provider timeoutMs has no 10-minute
// schema cap) to cover upload + processing for a realistically large video.
// This poll ceiling is raised to match, comfortably under that 30-minute
// outer bound, so if AssemblyAI itself is ever genuinely stuck this
// adapter's own clearer error fires before the generic engine-level abort.
const POLL_MAX_ATTEMPTS = 500; // ~25 minutes ceiling for a queued+processing job

interface AssemblyAIWord {
  text: string;
  start: number; // ms
  end: number; // ms
  confidence: number;
}

interface AssemblyAITranscript {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  error?: string;
  text?: string | null;
  words?: AssemblyAIWord[] | null;
  language_code?: string;
  audio_duration?: number | null; // seconds
}

const SENTENCE_END_RE = /[.!?…]["')\]]?$/;

// AssemblyAI has no direct "segments" concept in the base response (only
// words, plus optional per-speaker utterances we don't need here) — derived
// client-side by grouping words at sentence-ending punctuation, which
// AssemblyAI's formatted word text already includes by default. This is
// exactly the shape lib/transcription/segmentation.ts needs (startMs/endMs
// + text per segment) and avoids depending on the separate, unconfirmed
// /v2/transcript/{id}/sentences endpoint.
function wordsToSegments(words: AssemblyAIWord[]): TranscriptionResult["segments"] {
  const segments: TranscriptionResult["segments"] = [];
  let buffer: AssemblyAIWord[] = [];

  for (const word of words) {
    buffer.push(word);
    if (SENTENCE_END_RE.test(word.text)) {
      segments.push({
        text: buffer.map((w) => w.text).join(" "),
        startMs: buffer[0].start,
        endMs: buffer[buffer.length - 1].end,
      });
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    segments.push({
      text: buffer.map((w) => w.text).join(" "),
      startMs: buffer[0].start,
      endMs: buffer[buffer.length - 1].end,
    });
  }

  return segments;
}

export class AssemblyAITranscriptionProvider implements TranscriptionProvider {
  readonly id = "assemblyai";
  readonly category = "TRANSCRIPTION" as const;
  readonly model = "universal-3.5-pro";

  constructor(private readonly config: ProviderRuntimeConfig = {}) {}

  async transcribe(req: TranscriptionRequest): Promise<TranscriptionResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error("assemblyai is enabled but no API key is configured (Admin → AI Providers).");
    }

    const audioRes = await fetch(req.audioUrl);
    if (!audioRes.ok) {
      throw new Error(`Could not fetch source audio for transcription (${audioRes.status}).`);
    }
    const audioBuffer = await audioRes.arrayBuffer();

    // Raw bytes, not JSON or multipart — AssemblyAI's docs are explicit that
    // JSON/multipart bodies here return a successful-looking upload_url that
    // then fails downstream at transcription time.
    const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: { authorization: apiKey },
      body: audioBuffer,
    });
    if (!uploadRes.ok) {
      const body = await uploadRes.text().catch(() => "");
      throw new Error(`AssemblyAI upload failed (${uploadRes.status}): ${body.slice(0, 300)}`);
    }
    const { upload_url } = (await uploadRes.json()) as { upload_url: string };

    const submitRes = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: { authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(
        req.language
          ? { audio_url: upload_url, language_code: req.language }
          : { audio_url: upload_url, language_detection: true }
      ),
    });

    if (!submitRes.ok) {
      const body = await submitRes.text().catch(() => "");
      throw new Error(`AssemblyAI submit failed (${submitRes.status}): ${body.slice(0, 300)}`);
    }

    const submitted = (await submitRes.json()) as AssemblyAITranscript;

    let transcript: AssemblyAITranscript = submitted;
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      if (transcript.status === "completed" || transcript.status === "error") break;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${submitted.id}`, {
        headers: { authorization: apiKey },
      });
      if (!pollRes.ok) {
        const body = await pollRes.text().catch(() => "");
        throw new Error(`AssemblyAI poll failed (${pollRes.status}): ${body.slice(0, 300)}`);
      }
      transcript = (await pollRes.json()) as AssemblyAITranscript;
    }

    if (transcript.status === "error") {
      throw new Error(`AssemblyAI transcription failed: ${transcript.error ?? "unknown error"}`);
    }
    if (transcript.status !== "completed") {
      throw new Error(`AssemblyAI transcription timed out while still "${transcript.status}".`);
    }

    const words = transcript.words ?? [];

    return {
      segments: wordsToSegments(words),
      words: words.map((w) => ({ word: w.text, startMs: w.start, endMs: w.end })),
      language: transcript.language_code ?? req.language ?? "en",
      durationSeconds: transcript.audio_duration ?? 0,
      providerRef: transcript.id,
      usage: { seconds: transcript.audio_duration ?? undefined },
    };
  }
}
