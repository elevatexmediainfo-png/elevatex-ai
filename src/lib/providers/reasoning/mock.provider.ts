import { DEFAULT_REVEAL_CONFIG } from "@/lib/video-editor/text-style";
import type { ReasoningPlanRequest, ReasoningPlanResult, ReasoningProvider, ReasoningReeditRequest, ReasoningReeditResult } from "./types";

// Default provider (selected when no REASONING ProviderConfig is enabled)
// — deterministic captions chunked straight from the given words (one
// caption per ~8 words) and, when video-understanding emphasis moments
// were given, one subtle zoom per moment. Same simulated-latency pattern
// as the other category mocks; exercises the full pipeline (merge,
// persistence, UI) without API credentials.
const WORDS_PER_CAPTION = 8;

export class MockReasoningProvider implements ReasoningProvider {
  readonly id = "mock";
  readonly category = "REASONING" as const;

  async plan(req: ReasoningPlanRequest): Promise<ReasoningPlanResult> {
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const captions: ReasoningPlanResult["captions"] = [];
    for (let i = 0; i < req.words.length; i += WORDS_PER_CAPTION) {
      const chunk = req.words.slice(i, i + WORDS_PER_CAPTION);
      if (chunk.length === 0) continue;
      captions.push({
        text: chunk.map((w) => w.word).join(" "),
        startMs: chunk[0].startMs,
        endMs: chunk[chunk.length - 1].endMs,
        reveal: { ...DEFAULT_REVEAL_CONFIG, mode: "WORD" },
      });
    }

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
}
