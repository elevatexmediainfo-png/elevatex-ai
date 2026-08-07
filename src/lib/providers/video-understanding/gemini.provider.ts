import type { ProviderRuntimeConfig } from "../credentials";
import { pollUntilSettled } from "../poll";
import {
  VIDEO_FLAG_REASONS,
  type VideoFlagReason,
  type VideoUnderstandingProvider,
  type VideoUnderstandingRequest,
  type VideoUnderstandingResult,
} from "./types";

// Real adapter — Gemini's native video+audio understanding. Unlike every
// other Gemini adapter in this codebase (LLM/Images/Veo), which sends
// small inline-base64 payloads, a video needs Google's separate
// resumable-upload File API first (no SDK, matching this codebase's
// no-SDK convention — raw fetch, same as every other adapter here). Auth
// is the header convention (x-goog-api-key), matching gemini-images.ts/
// veo.provider.ts, not the older LLM adapter's ?key= query param.
// Real, confirmed-live incident (2026-08-03) — see the identical fix and
// comment in ../llm/gemini.provider.ts: a version-pinned snapshot
// ("gemini-2.5-flash") went stale (real 404, "no longer available to new
// users"). "gemini-flash-latest" is Google's own documented always-current
// alias — never needs a code change when Google retires a snapshot
// underneath it.
const DEFAULT_MODEL = "gemini-flash-latest";
const UPLOAD_BASE = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const FILE_POLL_INTERVAL_MS = 2000;
const FILE_POLL_MAX_ATTEMPTS = 90; // ~3 minutes for Google's own file-processing step

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    emphasisMoments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { startMs: { type: "INTEGER" }, endMs: { type: "INTEGER" }, description: { type: "STRING" } },
        required: ["startMs", "endMs", "description"],
      },
    },
    emotionBeats: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          startMs: { type: "INTEGER" },
          endMs: { type: "INTEGER" },
          emotion: { type: "STRING" },
          description: { type: "STRING" },
        },
        required: ["startMs", "endMs", "emotion", "description"],
      },
    },
    visualContext: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { startMs: { type: "INTEGER" }, endMs: { type: "INTEGER" }, description: { type: "STRING" } },
        required: ["startMs", "endMs", "description"],
      },
    },
    gestures: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { startMs: { type: "INTEGER" }, endMs: { type: "INTEGER" }, description: { type: "STRING" } },
        required: ["startMs", "endMs", "description"],
      },
    },
    flaggedSegments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          startMs: { type: "INTEGER" },
          endMs: { type: "INTEGER" },
          reason: { type: "STRING", enum: [...VIDEO_FLAG_REASONS] },
          description: { type: "STRING" },
        },
        required: ["startMs", "endMs", "reason", "description"],
      },
    },
  },
  required: ["emphasisMoments", "emotionBeats", "visualContext", "gestures", "flaggedSegments"],
};

const PROMPT = `You are analyzing raw, unedited footage for a video editor deciding what to cut. Watch the ENTIRE video (with audio) and return a structured JSON analysis with these fields, every timestamp in MILLISECONDS from the start of the video:

- emphasisMoments: brief moments where the speaker emphasizes a point (louder, slower, gesture, pause for effect).
- emotionBeats: notable emotional tone shifts (excited, serious, funny, etc).
- visualContext: what's visibly happening on screen at notable moments (setting, action, on-screen text).
- gestures: notable hand gestures, body language, or camera moves.
- flaggedSegments: segments a professional editor would CUT. Use exactly one of these five reasons for each:
  - "bad_take": the speaker visibly stumbles, misspeaks, or explicitly restarts what they're saying (e.g. "let me start over", "wait, that's wrong"), even if the words alone might sound fine out of context. Flag the STUMBLED portion, not the eventual clean delivery.
  - "duplicate_take": the SAME content/message is delivered more than once (a redo). Flag the WORSE of the two deliveries (the one to remove), not the better one that should be kept.
  - "quality_issue": visible blur, bad framing (subject cut off / off-center), or lighting problems severe enough to be distracting.
  - "camera_adjustment": the camera/phone is visibly being repositioned, refocused, or the shot is being reframed mid-recording — dead time with nothing to watch.
  - "dead_reaction": the speaker pauses with a blank/neutral expression and no meaningful reaction, gesture, or delivery — a genuinely empty beat, not a natural thinking pause mid-sentence (that's a transcript-timing concern, not a visual one).

Only flag segments you can actually observe evidence for — do not invent flagged segments if the footage is clean. Be precise with timestamps; they will be used to cut the video.`;

interface GeminiFileResource {
  name: string;
  uri: string;
  mimeType: string;
  state: "STATE_UNSPECIFIED" | "PROCESSING" | "ACTIVE" | "FAILED";
  sizeBytes?: string;
}

interface GeminiTimedMomentJson {
  startMs: number;
  endMs: number;
  description: string;
}

interface GeminiFlaggedSegmentJson extends GeminiTimedMomentJson {
  reason: string;
}

interface GeminiAnalysisJson {
  emphasisMoments?: GeminiTimedMomentJson[];
  emotionBeats?: (GeminiTimedMomentJson & { emotion?: string })[];
  visualContext?: GeminiTimedMomentJson[];
  gestures?: GeminiTimedMomentJson[];
  flaggedSegments?: GeminiFlaggedSegmentJson[];
}

function isValidFlagReason(reason: string): reason is VideoFlagReason {
  return (VIDEO_FLAG_REASONS as readonly string[]).includes(reason);
}

export class GeminiVideoUnderstandingProvider implements VideoUnderstandingProvider {
  readonly id = "gemini";
  readonly category = "VIDEO_UNDERSTANDING" as const;
  readonly model: string;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async analyze(req: VideoUnderstandingRequest, signal?: AbortSignal): Promise<VideoUnderstandingResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error("gemini (VIDEO_UNDERSTANDING) is enabled but no API key is configured (Admin → AI Providers).");
    }
    const authHeaders = { "x-goog-api-key": apiKey };

    const videoRes = await fetch(req.videoUrl, { signal });
    if (!videoRes.ok) {
      throw new Error(`Could not fetch source video for understanding (${videoRes.status}).`);
    }
    const mimeType = videoRes.headers.get("content-type") ?? "video/mp4";
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    // Step 1: start a resumable upload session — Google's File API, not the
    // small-payload inlineData shape every other Gemini adapter here uses.
    const startRes = await fetch(UPLOAD_BASE, {
      method: "POST",
      headers: {
        ...authHeaders,
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(videoBuffer.length),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: `ai-edit-${Date.now()}` } }),
      signal,
    });
    if (!startRes.ok) {
      const body = await startRes.text().catch(() => "");
      throw new Error(`Gemini file-upload start failed (${startRes.status}): ${body.slice(0, 300)}`);
    }
    const uploadUrl = startRes.headers.get("x-goog-upload-url");
    if (!uploadUrl) {
      throw new Error("Gemini file-upload start returned no upload URL.");
    }

    // Step 2: PUT the actual bytes, finalizing in the same request.
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(videoBuffer.length),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: videoBuffer,
      signal,
    });
    if (!uploadRes.ok) {
      const body = await uploadRes.text().catch(() => "");
      throw new Error(`Gemini file upload failed (${uploadRes.status}): ${body.slice(0, 300)}`);
    }
    const uploaded = (await uploadRes.json()) as { file: GeminiFileResource };
    let file = uploaded.file;

    // Step 3: Google processes uploaded video files asynchronously before
    // they're usable in generateContent — poll until ACTIVE.
    if (file.state !== "ACTIVE") {
      file = await pollUntilSettled(
        async () => {
          const pollRes = await fetch(`${API_BASE}/${file.name}`, { headers: authHeaders, signal });
          if (!pollRes.ok) return { status: "pending" as const };
          const polled = (await pollRes.json()) as GeminiFileResource;
          if (polled.state === "ACTIVE") return { status: "succeeded" as const, data: polled };
          if (polled.state === "FAILED") return { status: "failed" as const, error: "Gemini file processing failed." };
          return { status: "pending" as const };
        },
        { intervalMs: FILE_POLL_INTERVAL_MS, maxAttempts: FILE_POLL_MAX_ATTEMPTS, label: "Gemini file processing" }
      );
    }

    // Step 4: analyze — fileData references the uploaded file by URI,
    // structured JSON output constrained by RESPONSE_SCHEMA so the result
    // is parseable without prompt-engineering-fragile free text.
    //
    // Real resilience fix (2026-08-03) — retries only THIS step against the
    // stable alias (DEFAULT_MODEL) if the resolved model 404s as
    // unavailable; the already-uploaded file (steps 1-3 above) is reused
    // as-is, never re-uploaded, since the model is only referenced here.
    // No OpenAI-style fallback exists for VIDEO_UNDERSTANDING (no second
    // configured provider in this category), so unlike the LLM adapter this
    // only retries once and then surfaces the real error — there is
    // nothing further to fail over to.
    const analyzeModels = this.model === DEFAULT_MODEL ? [this.model] : [this.model, DEFAULT_MODEL];
    let analyzeRes: Response | undefined;
    for (let i = 0; i < analyzeModels.length; i++) {
      const model = analyzeModels[i];
      const attemptRes = await fetch(`${API_BASE}/models/${model}:generateContent`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ fileData: { mimeType: file.mimeType, fileUri: file.uri } }, { text: PROMPT }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
        }),
        signal,
      });
      if (attemptRes.ok) {
        analyzeRes = attemptRes;
        break;
      }
      const isLastAttempt = i === analyzeModels.length - 1;
      if (attemptRes.status === 404 && !isLastAttempt) continue; // retry with the stable alias
      const body = await attemptRes.text().catch(() => "");
      throw new Error(`Gemini video analysis failed (${attemptRes.status}) for model "${model}": ${body.slice(0, 300)}`);
    }
    const analyzeJson = await analyzeRes!.json();
    const text = analyzeJson.candidates?.[0]?.content?.parts?.[0]?.text;
    const usageTokens: number | undefined = analyzeJson.usageMetadata?.totalTokenCount;
    if (typeof text !== "string") {
      throw new Error("Gemini video analysis response did not contain a message.");
    }

    let parsed: GeminiAnalysisJson;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Gemini video analysis returned malformed JSON.");
    }

    const flaggedSegments = (parsed.flaggedSegments ?? [])
      .filter((f) => isValidFlagReason(f.reason))
      .map((f) => ({ startMs: f.startMs, endMs: f.endMs, reason: f.reason as VideoFlagReason, description: f.description }));

    return {
      emphasisMoments: parsed.emphasisMoments ?? [],
      emotionBeats: (parsed.emotionBeats ?? []).map((e) => ({ ...e, emotion: e.emotion ?? "neutral" })),
      visualContext: parsed.visualContext ?? [],
      gestures: parsed.gestures ?? [],
      flaggedSegments,
      durationSeconds: 0,
      providerRef: file.name,
      usage: { tokens: usageTokens },
    };
  }
}
