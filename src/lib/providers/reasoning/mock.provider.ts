import { DEFAULT_REVEAL_CONFIG } from "@/lib/video-editor/text-style";
import { buildFallbackCaptionsFromWords } from "@/lib/video-editor/caption-formatting";
import type {
  ReasoningAudioRequest,
  ReasoningAudioResult,
  ReasoningCaptionRequest,
  ReasoningCaptionResult,
  ReasoningPlanRequest,
  ReasoningPlanResult,
  ReasoningProvider,
  ReasoningQualityReviewRequest,
  ReasoningQualityReviewResult,
  ReasoningReeditRequest,
  ReasoningReeditResult,
  ReasoningStoryRequest,
  ReasoningStoryResult,
  ReasoningVisualsRequest,
  ReasoningVisualsResult,
} from "./types";

// Default provider (selected when no REASONING ProviderConfig is enabled)
// — deterministic captions chunked straight from the given words (one
// caption per <=12 words, line-balanced/punctuated — see
// caption-formatting.ts) and, when video-understanding emphasis moments
// were given, one subtle zoom per moment. Same simulated-latency pattern
// as the other category mocks; exercises the full pipeline (merge,
// persistence, UI) without API credentials.
//
// Fix (2026-08-06, FIX 5) — this used to inline its own "~8 words per
// caption" chunking loop with no line-formatting at all. Now reuses
// buildFallbackCaptionsFromWords, the SAME real-transcript-word chunker
// gpt5.provider.ts's resolveCaptionTiming() falls back to when the real
// model proposes nothing — one implementation of "never empty, always
// properly formatted" captions, not two independently-maintained copies.

export class MockReasoningProvider implements ReasoningProvider {
  readonly id = "mock";
  readonly category = "REASONING" as const;

  async plan(req: ReasoningPlanRequest): Promise<ReasoningPlanResult> {
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const captions: ReasoningPlanResult["captions"] = buildFallbackCaptionsFromWords(req.words).map((c) => ({
      text: c.text,
      startMs: c.startMs,
      endMs: c.endMs,
      reveal: { ...DEFAULT_REVEAL_CONFIG, mode: "WORD" },
    }));

    const zoom: ReasoningPlanResult["zoom"] = (req.videoAnalysis?.emphasisMoments ?? []).map((moment) => ({
      startMs: moment.startMs,
      endMs: moment.endMs,
      scaleFrom: 100,
      scaleTo: 115,
    }));

    // No broll/sticker/music/sfx/transition proposals — the mock has no
    // real understanding of what's "concrete and visualizable" in the
    // transcript, and inventing any would just be noise for a pipeline
    // exercise. Real proposals for all of these are GPT5ReasoningProvider's
    // own job (TASK 3-6 in its prompt).
    return { captions, zoom, broll: [], stickers: [], sfx: [], transitions: [], providerRef: `mock-reasoning-${Date.now()}` };
  }

  // Phase 12 Module 9 — honest, not faked: the mock has no real natural-
  // language understanding, so it can't genuinely interpret an arbitrary
  // instruction. Always "cannot_do" with a clear reason, same "don't
  // pretend to have understood" principle plan()'s own empty broll/
  // sticker/music/sfx/transitions above already follows.
  async reEdit(_req: ReasoningReeditRequest): Promise<ReasoningReeditResult> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      response: { action: "cannot_do", message: "The mock reasoning provider can't interpret re-edit instructions — configure a real REASONING provider (Admin → AI Providers) to use this feature." },
      providerRef: `mock-reedit-${Date.now()}`,
    };
  }

  // AI Video Director (2026-08-07) — required by ReasoningProvider's 5 new
  // methods (TypeScript structural typing), used when
  // AI_EDIT_DIRECTOR_PIPELINE_ENABLED is on. Same "never fabricate
  // insight" philosophy as plan()/reEdit() above: honest, cheap,
  // deterministic, and never a plausible-looking invention. A real
  // REASONING provider (GPT5ReasoningProvider) is required for the
  // Director pipeline to produce anything genuinely useful — these stubs
  // exist so the pipeline's WIRING (orchestration, scoring, translation)
  // is fully exercisable in tests without API credentials, the same role
  // plan()'s own empty broll/sticker/music/sfx/transitions already serve.
  async planStory(req: ReasoningStoryRequest): Promise<ReasoningStoryResult> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const hookText = req.words.slice(0, 8).map((w) => w.word).join(" ") || "Watch this.";
    return {
      beats: [{ kind: "value", startMs: 0, endMs: req.sourceDurationMs, description: "Mock provider — no real story structure, one beat spanning the whole video." }],
      hookText,
      // Explicitly neutral, never a fabricated judgment — the mock has no
      // real understanding of what makes a hook strong.
      retentionScore: 50,
      retentionRisks: [],
      ctaPresent: false,
    };
  }

  async planCaptions(req: ReasoningCaptionRequest): Promise<ReasoningCaptionResult> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const captions = buildFallbackCaptionsFromWords(req.words).map((c) => ({
      text: c.text,
      startMs: c.startMs,
      endMs: c.endMs,
      reveal: { ...DEFAULT_REVEAL_CONFIG, mode: "WORD" as const },
    }));
    return { captions };
  }

  async planVisuals(_req: ReasoningVisualsRequest): Promise<ReasoningVisualsResult> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    // No real understanding of what's concrete/visualizable — same reason
    // plan()'s own broll/stickers come back empty from the mock.
    return { zoom: [], broll: [], stickers: [], transitions: [] };
  }

  async planAudio(_req: ReasoningAudioRequest): Promise<ReasoningAudioResult> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { sfx: [] };
  }

  async reviewQuality(_req: ReasoningQualityReviewRequest): Promise<ReasoningQualityReviewResult> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Flat, mid-range, non-committal scores that never trigger a retry
    // loop in tests exercising the mock provider (weakCategories: []) —
    // an honest "I have no real opinion," not a manufactured pass/fail.
    return {
      hookScore: 60,
      retentionScore: 60,
      storyScore: 60,
      weakCategories: [],
    };
  }
}
