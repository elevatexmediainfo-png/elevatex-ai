import { planCommercialFromScript, CommercialDirectorError } from "./director/commercial-director";

// AI Director System (2026-07-27) — this file's real planning logic
// (system prompt, schema, LLM call) moved to
// director/commercial-director.ts, this app's second concrete "Director"
// implementation (the first being director/film-director.ts). This file is
// now a thin compatibility layer preserving the exact external shape every
// existing caller already depends on (scenes/engine.ts,
// veo-multiscene-video.ts) — re-exported here rather than changed at each
// call site, so this migration is a pure internal refactor, not a
// breaking API change anywhere else in the codebase.
export { CommercialDirectorError as SceneSplitError };

export interface SceneSplitScene {
  sceneNumber: number;
  visualPrompt: string;
  durationSeconds: number;
}

export interface SceneSplitTextOverlay {
  afterSceneNumber: number;
  text: string;
}

export interface SceneSplit {
  scenes: SceneSplitScene[];
  textOverlays: SceneSplitTextOverlay[];
}

export async function splitScriptIntoScenes(script: string, userId: string): Promise<SceneSplit> {
  const plan = await planCommercialFromScript(script, userId);
  return {
    scenes: plan.scenes.map((scene) => ({
      sceneNumber: scene.sceneNumber,
      visualPrompt: scene.visualPrompt,
      durationSeconds: scene.durationSeconds,
    })),
    textOverlays: plan.textOverlays,
  };
}
