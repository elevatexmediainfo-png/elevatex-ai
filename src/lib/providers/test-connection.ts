import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import Razorpay from "razorpay";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

import type { ProviderCategory } from "@/generated/prisma/client";
import type { ProviderRuntimeConfig } from "./credentials";

export interface TestConnectionResult {
  ok: boolean;
  message: string;
}

async function testWithFetch(
  url: string,
  init: RequestInit,
  okMessage: string
): Promise<TestConnectionResult> {
  try {
    const res = await fetch(url, init);
    if (res.ok) return { ok: true, message: okMessage };
    const body = await res.text().catch(() => "");
    return { ok: false, message: `Request failed (${res.status}): ${body.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// Admin Panel's "Test Connection" button — a minimal, cheap, read-only call
// against each vendor's API to confirm credentials actually work, without
// spending on a real generation. Where a vendor exposes no documented cheap
// read endpoint (the four best-effort video adapters), this falls back to a
// shape-only check and says so plainly rather than pretending to have
// verified live access.
export async function testProviderConnection(
  category: ProviderCategory,
  providerId: string,
  config: ProviderRuntimeConfig
): Promise<TestConnectionResult> {
  switch (providerId) {
    case "openai":
    case "openai_images":
    case "openai_whisper":
      // Whisper has no dedicated cheap verification endpoint; listing
      // models confirms the key is valid for the OpenAI API generally, the
      // same documented limitation as the veo/Gemini pairing above.
      if (!config.apiKey) return { ok: false, message: "No API key configured." };
      return testWithFetch(
        "https://api.openai.com/v1/models",
        { headers: { Authorization: `Bearer ${config.apiKey}` } },
        "OpenAI API key is valid."
      );

    case "gemini":
    case "veo":
    case "gemini_images":
    case "imagen": {
      // Veo/gemini_images/imagen all share the Gemini API key; listing
      // models only confirms the key is valid for the Generative Language
      // API, not specifically that this account has access to each
      // individual model (that needs a billing-enabled project, verified
      // separately at generation time) — documented limitation, not a fake
      // pass.
      if (!config.apiKey) return { ok: false, message: "No API key configured." };
      const result = await testWithFetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`,
        {},
        "Gemini API key is valid."
      );
      if (providerId === "veo" && result.ok) {
        return { ok: true, message: "API key is valid for the Gemini API (Veo-specific access not separately verifiable)." };
      }
      if (providerId === "gemini_images" && result.ok) {
        return {
          ok: true,
          message: "Connection successful. The API key is valid. Image model access will be verified automatically during the first real image generation request.",
        };
      }
      if (providerId === "imagen" && result.ok) {
        return {
          ok: true,
          message: "API key is valid for the Gemini API (Imagen-specific access not separately verifiable — note: imagen-4.0-generate-001 is deprecated, shutting down 2026-08-17).",
        };
      }
      return result;
    }

    case "elevenlabs":
      if (!config.apiKey) return { ok: false, message: "No API key configured." };
      return testWithFetch(
        "https://api.elevenlabs.io/v1/user",
        { headers: { "xi-api-key": config.apiKey } },
        "ElevenLabs API key is valid."
      );

    case "assemblyai":
      if (!config.apiKey) return { ok: false, message: "No API key configured." };
      return testWithFetch(
        "https://api.assemblyai.com/v2/transcript?limit=1",
        { headers: { authorization: config.apiKey } },
        "AssemblyAI API key is valid."
      );

    case "gpt4o_transcribe":
      // Fix (2026-07-27) — credential-slot-only, no adapter built yet (see
      // lib/admin/ai-providers.ts's PROVIDER_CATALOGUE) — was falling
      // through to the generic default message. Same honest, non-error
      // shape as gemini_omni/omnihuman/icons8/lottiefiles below.
      return {
        ok: true,
        message: "Credentials saved successfully. This provider is reserved for future implementation.",
      };

    case "edge_tts": {
      // Fix (2026-07-27) — real, actively-used adapter (voice/edge-tts.
      // provider.ts, the real free fallback when ElevenLabs is
      // unavailable), but needs no API key at all, so it was falling
      // through to the generic default message despite genuinely working.
      // No HTTP endpoint exists to test (it's a WebSocket protocol, not
      // REST) — reuses the exact same MsEdgeTTS.setMetadata() call the
      // real adapter's own generate() makes, the same "call the real
      // underlying request, just the cheapest slice of it" pattern this
      // file already uses elsewhere (Coverr reuses its own real search
      // endpoint) — but stops before toStream()/synthesis, so no audio is
      // actually generated or uploaded.
      try {
        const tts = new MsEdgeTTS();
        await tts.setMetadata("en-US-AriaNeural", OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        tts.close();
        return { ok: true, message: "Edge TTS is reachable (no API key required)." };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
      }
    }

    case "flux":
    case "replicate":
      if (!config.apiKey) return { ok: false, message: "No API token configured." };
      return testWithFetch(
        "https://api.replicate.com/v1/account",
        { headers: { Authorization: `Bearer ${config.apiKey}` } },
        "Replicate API token is valid."
      );

    case "ideogram":
      // Real bug fix (2026-07-24) — `/manage/account` doesn't exist
      // (confirmed live: a real 404, "requested URL was not found on the
      // server"). Empirically probed for a real replacement first, not
      // guessed: no dedicated account/credits GET endpoint exists in
      // Ideogram's current API, and the real v3 generate endpoint
      // (`/v1/ideogram-v3/generate`) returns the SAME 405 "Method Not
      // Allowed" for a GET regardless of whether the API key is real,
      // fake, or missing entirely — method validation happens before auth,
      // so it can't distinguish a valid key from an invalid one either.
      // Same honest "no cheap verification endpoint exists" precedent as
      // the "kling" case above, rather than a URL guess that would just
      // trade one wrong 404 for a different wrong one.
      if (!config.apiKey) return { ok: false, message: "No API key configured." };
      return {
        ok: true,
        message: "API key is present (Ideogram has no documented cheap verification endpoint — not a live-tested connection).",
      };

    case "kling":
      if (!config.apiKey || !config.apiSecret) {
        return { ok: false, message: "Access key/secret are required." };
      }
      return {
        ok: true,
        message: "Access key/secret are present (Kling has no documented cheap verification endpoint — not a live-tested connection).",
      };

    case "hailuo":
      if (!config.apiKey) return { ok: false, message: "No API key configured." };
      return {
        ok: true,
        message: "API key is present (Hailuo/MiniMax has no documented cheap verification endpoint — not a live-tested connection).",
      };

    case "runway":
      if (!config.apiKey) return { ok: false, message: "No API key configured." };
      return testWithFetch(
        "https://api.dev.runwayml.com/v1/organization",
        { headers: { Authorization: `Bearer ${config.apiKey}`, "X-Runway-Version": "2024-11-06" } },
        "Runway API key is valid."
      );

    case "sora":
      // Sora shares OpenAI's general API key; listing models only confirms
      // the key is valid for the OpenAI API generally, not specifically
      // that this account has Sora access — same documented limitation as
      // the gemini/veo pairing above.
      if (!config.apiKey) return { ok: false, message: "No API key configured." };
      return testWithFetch(
        "https://api.openai.com/v1/models",
        { headers: { Authorization: `Bearer ${config.apiKey}` } },
        "API key is valid for the OpenAI API (Sora-specific access not separately verifiable)."
      );

    case "gpt5":
      // Fix (2026-07-27) — gpt5 (REASONING) has a real, actively-used adapter
      // (reasoning/gpt5.provider.ts) and shares OpenAI's general API key,
      // but had no case here at all, so it was falling through to the
      // generic default message despite being a genuinely working
      // provider. Same shared-key/documented-limitation shape as sora above.
      if (!config.apiKey) return { ok: false, message: "No API key configured." };
      return testWithFetch(
        "https://api.openai.com/v1/models",
        { headers: { Authorization: `Bearer ${config.apiKey}` } },
        "API key is valid for the OpenAI API (GPT-5.x reasoning access not separately verifiable)."
      );

    case "seedance2":
      // Real bug fix (2026-07-24) — this message previously said
      // "Volcengine Ark", the wrong vendor entirely (see
      // seedance.provider.ts's own doc comment for the full story: the
      // real provider is the third-party service Seedance2.ai, unrelated
      // to ByteDance/Volcengine). Confirmed against Seedance2.ai's real
      // docs that no lightweight account/credits/key-check GET endpoint
      // exists — only a paid task-creation call and a task-status poll —
      // so this stays the same honest "present, not live-tested" shape,
      // just naming the real vendor now.
      if (!config.apiKey) return { ok: false, message: "No API key configured." };
      return {
        ok: true,
        message: "API key is present (Seedance2.ai has no documented cheap verification endpoint — not a live-tested connection).",
      };

    case "gemini_omni":
    case "omnihuman":
      // Fix (2026-07-27) — both credential-slot-only, no adapter built yet
      // (see lib/admin/ai-providers.ts's PROVIDER_CATALOGUE comment: "all
      // new catalogue entries are credential-slot-only, no adapter,
      // matching the IconScout precedent") — but unlike icons8/lottiefiles,
      // these two never got a matching case here, so they fell through to
      // the generic default message. gemini_omni shares the Gemini API key
      // (same vendor as gemini/veo/gemini_images/imagen above) and
      // omnihuman shares no key with any other tested provider here, but
      // deliberately NOT merged into the Gemini group above: with no real
      // adapter to consume it, a "the key works" result would be more
      // presumptuous than useful — same reasoning icons8/lottiefiles
      // already established for this exact situation.
      return {
        ok: true,
        message: "Credentials saved successfully. This provider is reserved for future implementation.",
      };

    case "s3": {
      const bucket = config.extraConfig?.bucket;
      const region = config.extraConfig?.region;
      if (!bucket || !region) return { ok: false, message: "Bucket/region are required." };
      try {
        const client = new S3Client({
          region,
          endpoint: config.extraConfig?.endpoint,
          forcePathStyle: !!config.extraConfig?.endpoint,
          credentials:
            config.apiKey && config.apiSecret
              ? { accessKeyId: config.apiKey, secretAccessKey: config.apiSecret }
              : undefined,
        });
        // Fix (2026-07-21) — HeadBucketCommand used to be the check here,
        // but against a real credential-mismatch error (confirmed live: R2
        // rejecting a wrong-length access key) its response came back in a
        // shape the SDK's XML error parser couldn't classify, surfacing
        // only the SDK's own internal fallback name "UnknownError" — no
        // actual detail, useless for debugging. ListObjectsV2 against the
        // same bucket exercises the identical auth path but returns a
        // properly parseable S3 error body on failure (confirmed live: the
        // exact same bad credentials produced a clear, specific
        // "Credential access key has length 53, should be 32" instead).
        await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
        return { ok: true, message: `Bucket "${bucket}" is reachable.` };
      } catch (err) {
        const name = err instanceof Error ? err.name : undefined;
        const message = err instanceof Error ? err.message : String(err);
        // Some SDK failure modes (a response body the XML parser can't
        // classify) still only produce a bare name with no real message —
        // include both rather than let a genuinely unhelpful case regress
        // to the same silent "UnknownError" this fix was for.
        const combined = name && name !== message ? `${name}: ${message}` : message;
        return { ok: false, message: combined };
      }
    }

    case "resend":
      if (!config.apiKey) return { ok: false, message: "No API key configured." };
      return testWithFetch(
        "https://api.resend.com/domains",
        { headers: { Authorization: `Bearer ${config.apiKey}` } },
        "Resend API key is valid."
      );

    case "pexels":
      // No Bearer prefix — Pexels expects the raw key in Authorization.
      // Confirmed live (2026-07-10): unlike OpenAI/ElevenLabs/Replicate,
      // Pexels' /v1/search endpoint returns a real 200 with real results
      // even for a garbage/placeholder Authorization value — it does not
      // reject an invalid key with a 401 the way this test's "ok: false"
      // path implies. A real request genuinely reaches Pexels either way
      // (this isn't a mock), but an "ok: true" result here only confirms
      // the request succeeded, not that the configured key is specifically
      // valid — a real invalid key would need to be tested against a
      // higher-volume/rate-limited call to distinguish from a valid one.
      if (!config.apiKey) return { ok: false, message: "No API key configured." };
      return testWithFetch(
        "https://api.pexels.com/v1/search?query=test&per_page=1",
        { headers: { Authorization: config.apiKey } },
        "Pexels responded successfully (Pexels does not reject an invalid key with a 401 on this endpoint, so this confirms reachability, not key validity)."
      );

    case "pixabay":
      // Pixabay requires per_page >= 3, even for a throwaway test call.
      if (!config.apiKey) return { ok: false, message: "No API key configured." };
      return testWithFetch(
        `https://pixabay.com/api/?key=${encodeURIComponent(config.apiKey)}&q=test&per_page=3`,
        {},
        "Pixabay API key is valid."
      );

    case "coverr":
      if (!config.apiKey) return { ok: false, message: "No API key configured." };
      // A real, cheap search call — Coverr's docs don't document a
      // dedicated lightweight verification endpoint, so this reuses the
      // same /videos search the adapter itself calls, with page_size=1.
      return testWithFetch(
        "https://api.coverr.co/videos?query=test&page_size=1",
        { headers: { Authorization: `Bearer ${config.apiKey}` } },
        "Coverr API key is valid."
      );

    case "unsplash":
      if (!config.apiKey) return { ok: false, message: "No Access Key configured." };
      return testWithFetch(
        "https://api.unsplash.com/search/photos?query=test&per_page=1",
        { headers: { Authorization: `Client-ID ${config.apiKey}` } },
        "Unsplash Access Key is valid."
      );

    case "openverse":
      // No credentials of any kind are required for basic search — this
      // is a real reachability check, not a key-validity check, since
      // there IS no key to validate. Same real /images search the adapter
      // itself calls.
      return testWithFetch(
        "https://api.openverse.org/v1/images/?q=test&page_size=1",
        {},
        "Openverse is reachable (no API key required for search)."
      );

    case "lottiefiles":
      // No adapter is wired for LottieFiles yet — see
      // lib/providers/stock-media/registry.ts's header comment: the
      // endpoint this would need to hit doesn't resolve, and no confirmed
      // public search API was found to replace it with. Same "adapter not
      // yet implemented" framing as iconscout/icons8 below, not the
      // "present but not live-tested" pattern kling/hailuo/seedance2 use
      // (that pattern is for a real, working request this codebase simply
      // hasn't confirmed the RESULT of yet — this is different, the
      // request itself has nowhere real to go).
      return { ok: false, message: "Adapter not yet implemented — credentials saved for future use." };

    case "iconscout":
      // Confirmed live (2026-07-11): a real unauthenticated request to
      // this exact endpoint returns a real, structured 500 with
      // {"message":"Client-ID is missing.", ...} — an invalid/missing
      // Client-ID is genuinely rejected (same strong signal as Pixabay,
      // not Pexels' weaker "accepts anything" behavior).
      if (!config.apiKey) return { ok: false, message: "No Client-ID configured." };
      return testWithFetch(
        "https://api.iconscout.com/v3/search?query=test&asset=icon&per_page=1",
        { headers: { "Client-ID": config.apiKey } },
        "IconScout Client-ID is valid."
      );

    case "icons8":
      // Milestone 26 — credential slot ready, adapter not yet built (see
      // lib/providers/stock-media/registry.ts). Distinguishing this from
      // the generic default message below so an admin doesn't mistake it
      // for a typo'd provider id.
      return { ok: false, message: "Adapter not yet implemented — credentials saved for future use." };

    case "razorpay": {
      if (!config.apiKey || !config.apiSecret) {
        return { ok: false, message: "Key id/secret are required." };
      }
      try {
        const client = new Razorpay({ key_id: config.apiKey, key_secret: config.apiSecret });
        await client.orders.all({ count: 1 });
        return { ok: true, message: "Razorpay key id/secret are valid." };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
      }
    }

    default:
      return { ok: false, message: `No connection test implemented for "${providerId}".` };
  }
}
