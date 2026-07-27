import {
  planFilm,
  FilmDirectorError,
  clampSceneDuration,
  trimScenesToTotalDuration,
  FILM_SCENE_GENERATION_FLOOR_SECONDS,
  type FilmDirectorInput,
  type FilmDirectorCharacterInput,
} from "./director/film-director";

// AI Director System (2026-07-27) — this file's real planning logic (system
// prompt, schema, LLM call, duration-trimming) moved to
// director/film-director.ts, this app's first concrete "Director"
// implementation. This file is now a thin compatibility layer preserving
// the exact external shape every existing caller already depends on
// (storyboard/route.ts, film-scene-video.ts) — re-exported here rather than
// changed at each call site, so this migration is a pure internal
// refactor, not a breaking API change anywhere else in the codebase.
export { FILM_SCENE_GENERATION_FLOOR_SECONDS, clampSceneDuration, trimScenesToTotalDuration };
export type SplitFilmIntoStoryboardInput = FilmDirectorInput;
export type FilmStoryboardCharacterInput = FilmDirectorCharacterInput;
// Aliased, not subclassed — planFilm() throws real FilmDirectorError
// instances; storyboard/route.ts's `err instanceof FilmStoryboardError`
// check needs to match the SAME runtime class, not a new one that no error
// this module produces is ever actually an instance of.
export { FilmDirectorError as FilmStoryboardError };

export interface FilmStoryboardScene {
  sceneNumber: number;
  visualPrompt: string;
  spokenLine: string | null;
  durationSeconds: number;
  characterSlotIndex: number | null;
}

export interface FilmStoryboard {
  scenes: FilmStoryboardScene[];
}

export async function splitFilmIntoStoryboard(input: SplitFilmIntoStoryboardInput): Promise<FilmStoryboard> {
  const plan = await planFilm(input);
  return {
    scenes: plan.scenes.map((scene) => ({
      sceneNumber: scene.sceneNumber,
      visualPrompt: scene.visualPrompt,
      spokenLine: scene.spokenLine ?? null,
      durationSeconds: scene.durationSeconds,
      characterSlotIndex: scene.characterSlotIndex ?? null,
    })),
  };
}
