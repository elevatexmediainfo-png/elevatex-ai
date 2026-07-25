// Pure persistent-media-slot assignment for the Cloud Video Editor's
// compositor. Extracted from compositor-stage.tsx (same convention as
// track-stacking.ts) so it's unit-testable without mounting a React
// component or fighting vitest's JSX parsing of a .tsx source file — see
// track-slot-assignment.test.ts.
//
// Real, severe bug fixed live 2026-07-19 — every VIDEO/AUDIO clip used to
// mount its OWN fresh <video>/<audio> DOM element, each graphed into the
// shared Web Audio context via a brand-new createMediaElementSource()
// call. Confirmed with a real, reproducible measurement (see
// PROJECT_STATUS.md's own entry): the FIRST such connection in a page
// session plays back perfectly, but every connection after that breaks
// the NEW element's own video decode clock — readyState stays at 4
// (HAVE_ENOUGH_DATA, no buffering issue) while currentTime simply stops
// advancing on its own, and the app's drift-correction papers over it
// with a hard seek roughly every 400ms, producing a near-continuous
// freeze-then-jump stutter for ~88% of the rest of that clip's own
// lifetime. A controlled diagnostic (removing the graph connection
// entirely) dropped a dense scene-removal project's measured stutter
// from 12,076ms to 83ms across 8 clip boundaries.
//
// The fix: each VIDEO/AUDIO track owns exactly 2 persistent elements
// ("slots"), created once and reused for every clip that ever plays on
// that track — createMediaElementSource() is called AT MOST twice per
// track, ever, not once per clip. This function decides which slot a
// given set of currently-active clip ids occupies.
export function assignTrackSlots(activeIds: string[], prevSlots: [string | null, string | null]): [string | null, string | null] {
  let [slot0Id, slot1Id] = prevSlots;

  // Rule 1 — a clip that's STILL active and already owns a slot keeps
  // it: an ordinary mid-clip re-render never swaps slots or touches
  // `src`.
  if (slot0Id && !activeIds.includes(slot0Id)) slot0Id = null;
  if (slot1Id && !activeIds.includes(slot1Id)) slot1Id = null;

  // Rule 2 — a newly-active clip claims whichever slot isn't held by a
  // still-active clip. This is genuinely all a Module 9 transition
  // overlap needs too: clipA already owns a slot from before the
  // overlap began (rule 1), so clipB simply claims the other one for
  // the overlap's duration — no transition-specific branch required.
  for (const id of activeIds) {
    if (id === slot0Id || id === slot1Id) continue;
    if (slot0Id === null) slot0Id = id;
    else if (slot1Id === null) slot1Id = id;
    // A 3rd simultaneously-active clip on one track can't happen today —
    // transitions cap at exactly 2 overlapping clips. If it somehow did,
    // the extra clip is silently dropped rather than growing the pool,
    // matching compositor-stage.tsx's existing "no renderer for this
    // case" fallback philosophy (see its EFFECTS track-kind branch).
  }

  return [slot0Id, slot1Id];
}
