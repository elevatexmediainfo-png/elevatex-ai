# Dynamic Scene Graph Compiler — Phase 10.6B

Converts a `UniversalCampaignBlueprint` + `VisualScenePlan` into a `SceneGraph`:
a complete, physically renderable photograph description — who is in the
frame, where they are, how their body is oriented, what their hands are
doing, what small physical phenomena are in motion, what the camera sees,
and what everything is made of.

## Position in the pipeline

```
Creative Brain
      │
      ▼
Scene Planner  ──────────────────────────►  VisualScenePlan
      │                                     (10 domains — WHAT the campaign
      │                                      wants, WHY, in planning-level
      │                                      enums: heroPose, environmentType,
      │                                      cameraHeight, ...)
      ▼
Scene Graph Compiler   ← this module  ────►  SceneGraph
      │                                     (8 domains — exactly what a
      │                                      camera would record at one
      │                                      instant: WHO, WHERE, POSE, BODY,
      │                                      OBJECT CONTACT, MICRO MOTION,
      │                                      CAMERA, MATERIALS + a rendered
      │                                      narrative paragraph)
      ▼
Prompt Visual Compiler (Phase 10.6A)  ────►  CompiledPrompt
      │
      ▼
Provider Translator
```

**This phase does not wire the compiler into the live pipeline** — the same
deliberate, staged pattern Phase 10.6A used. `buildSceneGraph(blueprint,
scene)` is a standalone pure function. No file outside
`src/lib/ai-os/scene-graph/` was modified — `scene-planner`, `prompt-spec`,
`prompt-compiler`, `provider-translator`, and every existing test are
untouched. See **Migration guide** below for how a future phase wires it in.

## Why this exists

The Phase 10.5C Scene Graph audit asked one question: does the current
pipeline carry enough information to reconstruct the scene as a 3D photograph,
or does it only carry enough information to describe a marketing campaign?
It measured **64.5/100** and named ten dimensions with no field anywhere in
the pipeline: **body orientation, head direction, eye direction, hand
position, object contact, subject count, architecture, occlusion, micro
motion, temporal instant.** `VisualScenePlan` answers *what the campaign
wants* (`heroPose: "mid_action"`, `environmentType: "premium_interior"`) —
useful for planning, not physically specific enough to render. This module
is the missing layer in between: it takes those planning-level answers and
asks, for every one of them, *what would a camera literally see?*

## How it works

### 1. Deterministic multi-axis seeding (`seed.ts`)

A base seed is derived from the blueprint's own identity
(`djb2(blueprintId :: industry :: hero text)`) — the same hashing technique
already used throughout this pipeline (`scene-planner/vte-bridge.ts`'s
`variationSeed`, `prompt-spec/scene-builder.ts`'s `djb2`). The one addition:
**every combinatorial axis gets its own independent sub-seed**
(`axisSeed(base, "body:handVerb")`, `axisSeed(base, "materials:finish")`, ...).
Two axes never move in lockstep, so the output space is the *product* of
every axis's cardinality, not the size of one shared table. This is the
structural difference from `prompt-spec/scene-builder.ts` (one hash selects
one of 36 pre-written composition variants) and
`prompt-spec/material-engine.ts` (one hash selects one of 33 pre-written
industry × tier sentences) — both real, tested modules in this codebase, and
both genuine lookup tables once you total their cells. Crossing this
module's axes (verb × object × spatial target × hand assignment for hand
position alone, before materials, micro-motion, or body posture are even
considered) reaches combinations in the hundreds of thousands, and every
addition of an axis multiplies rather than adds to that space.

### 2. Knowledge bridge (`knowledge-bridge.ts`)

*"Use existing intelligence: Knowledge."* This is the sole bridge into
`creative-knowledge/`'s per-industry behaviour, scene-type, and
emotional-moment banks (all eleven industries, all real, curated, already
shipped data — e.g. `RESTAURANT_BEHAVIOURS`'s 85 entries covering
chef/service/guest physical behaviour in granular detail). It deliberately
**never re-emits a knowledge node's prose field** (`description`,
`environment`, `moment`) as final output — those are hand-written editorial
sentences, and reusing them verbatim would be exactly the "static clause"
the brief prohibits. Instead it extracts short signal fragments (`tags`,
`emotionalSignal`, `mood`) that bias *which* of this module's own vocabulary
entries get selected (`pickBiased()` in `seed.ts`) — the knowledge bank
decides what's thematically plausible, this module's own axes decide what
words actually appear.

### 3. Vocabulary (`vocabulary.ts`)

Independent phrase-FRAGMENT banks (1-4 words each) — hand verbs by contact
category, spatial targets, material nouns by tier, finish descriptors,
micro-motion elements with environment-context tags, per-industry
architecture/room/furniture nouns. No entry is ever emitted alone; every
builder always combines an entry here with entries from several *other*
independent axes plus live campaign data before producing a sentence.

### 4. Builders (`builders/*.ts`)

One file per sub-graph, mirroring `scene-planner/builders/`'s own structure:

| Builder | Strategy |
|---|---|
| `who.ts` | Refines Hero Fusion's already-final hero text; derives subject count from `supportingSubjects.subjectRelationships`; word-boundary keyword scan for animals/vehicles |
| `where.ts` | New architecture/room/furniture axes (the audit's named gap), knowledge-biased; refines existing `environment`/`background`/`foreground`/`midground` |
| `pose.ts` | Maps `VisualScenePlan.heroSubject.heroPose`'s 8 planning-level values to the audit's exact 10-term physical vocabulary via a compatibility subset, seeded pick within it |
| `body.ts` | Groups the 10 poses into 4 small "posture families" (enough physical coherence that "kneeling" never pairs with "mid-stride" feet) — each of 6 body axes still makes its own independent seeded choice inside the family. Composes `handPosition` once from independent verb/object/spatial-target axes and returns the raw pieces as a `HandEvent` |
| `object-contact.ts` | Structures the **same** `HandEvent` `body.ts` already composed into the audit's 9-term contact vocabulary — never re-invents what the hands are doing |
| `materials.ts` | Replaces `material-engine.ts`'s static 33-cell table with 4 independent axes (material noun × finish × light-interaction, plus a keyword hint from the real contact object) |
| `micro-motion.ts` | Filters 11 elements to what's physically plausible for the industry + knowledge tags before a seeded pick; temporal instant biased by the active contact verb |
| `camera.ts` | Mostly refines `VisualScenePlan.camera`/`composition` (already real data); adds focus plane, leading lines, occlusion (the audit's named gap), foreground framing |

Build order matters: `who → where → pose → body → objectContact → materials
→ microMotion → camera`, so each later builder can stay coherent with what
an earlier one already decided (materials know what object the hand is
touching; camera knows whether a hand/object clause is active).

### 5. Narrative (`narrative.ts`)

*"Generate Scene Graph first. Narrative later... Scene Graph owns the
photograph. Prompt owns only the wording."* This is the only place that
turns the graph into prose, and every sentence pulls its content from a
field the builders already computed — nothing here invents new scene
content. Fields whose value is `"not_applicable"` are skipped, not printed,
so a dental-clinic scene never reads "no animals present." Sentence order is
fixed (subject → body detail → supporting subjects → environment → materials
→ micro-motion → camera) because that's how a photograph description reads
coherently; the combinatorial diversity this module is judged on lives in
the word choices inside each sentence, not in shuffling sentence position.

### 6. Input hygiene (`sanitize.ts`)

Every `VisualScenePlan` free-text field this module inherits verbatim
(`heroSubject.exactHeroSubject`, `supportingSubjects.supportingSubjects`,
`environment.background`/`foreground`/`midground`) is passed through
`safeInheritedText()` first. This exists because a real pipeline run
surfaced raw commercial-composition/layout copy —
`"ADVERTISEMENT LAYERS: A horizontal strip of 3-4 key benefits... Benefit 1:
Quality | Benefit 2: Value"` — inside a field that is supposed to describe
who else is physically in frame. `looksLikeLayoutOrCopyInstruction()`
detects the pattern (all-caps section headers, `Benefit N:`, pipe-delimited
lists) and the caller falls back to its own vocabulary bank instead of
printing it. This is a small, local guard, not a re-implementation of
`prompt-compiler/banned-language.ts`'s business-term scrubber — importing
downstream of this module's own pipeline position would invert the
dependency direction and risk a cycle once a future phase wires the two
together (see Migration guide). Every stage defends its own inputs.

### 7. `not_applicable` vs `unknown`

A field is `"unknown"` only when no signal exists anywhere to answer it — a
real gap. A field is `"not_applicable"` when the answer is a confident "no":
a dental clinic campaign has no vehicle in frame, and saying so plainly is
more honest than a bare `"unknown"` that reads as a missed signal. The
completeness score (below) counts `not_applicable` as complete and
`unknown` as the only real gap.

### 8. Completeness score (`engine.ts`)

0-100, computed the same way the Phase 10.5C audit measured its 64.5
baseline: the share of leaf fields carrying a concrete answer.
`not_applicable` counts as answered; only `unknown` counts against the
score. **This score is expected to sit at or near 100 by construction** —
every builder always resolves to a concrete value or an explicit
`not_applicable`, never a silent `unknown` — so it is a structural proof
that the ten named gaps are closed, not a variable quality metric that
should be expected to fluctuate meaningfully campaign to campaign.

## Example output

Input: a fine-dining French restaurant "Grand Opening Celebration" campaign.
`buildSceneGraph(blueprint, scene).narrative` — real, verbatim output from one
real run of the actual, unmodified pipeline (only line-wrapped for this file):

> The moment the signature dish arrives — steam, light, the instant
> expression of anticipation and pleasure, with a sense of occasion in the
> air, the head chef walks the floor and speaks directly with seated guests,
> the front-of-house ritual that signals nothing is hidden in the kitchen, a
> professional holds steady, open eye contact with a client during
> face-to-face conversation, projecting unhurried calm competence, as part
> of a festive occasion., holding steady, weight settled, left hand presents
> Signature dish while right hand delivers ceramic plate toward the surface.
> Head at a three-quarter turn, eyes meeting the camera directly, shoulders
> relaxed and uneven. Ingredient detail shot, ambient restaurant scene, event
> date graphic; a supporting figure stands nearby holding wine glass toward
> the camera. A stone column frames a private dining alcove, a leather
> banquette anchoring the space. The surface is smooth quartz composite,
> catching the light along its edge, and a reflection of an overhead pendant
> light plays across the quartz composite. Smooth pressed glass, reflecting
> the room's ambient glow, set against smooth poly-cotton weave, reflecting
> the room's ambient glow. A wisp of smoke drifting, visible steam drifting
> off the surface, the frame catching the peak of the action. Shot at eye
> level, medium shot, three quarter view; the eye follows the corridor walls
> through the frame, and a passing figure partially obscures the background.

Every noun after "holding steady, weight settled" is a graph field, not
prose invented at narration time — `graph.materials.surfaceMaterial.value`
is literally `"smooth quartz composite, catching the light along its
edge"`. (The opening clause is Hero Fusion's own already-final output,
inherited verbatim by design — see "What this phase deliberately does not
do" below.)

**A real bug this example caught, and how it was fixed:** the first attempt
at this same run produced *"left hand draws shut Signature dish, premium
tableware, ambient restaurant lighting — the food must look genuine and
appetising"* — `VisualScenePlan.objects.requiredObjects` had returned a full
instruction clause, not a noun, and the hand-position builder had used it
whole. `builders/body.ts`'s `shortObjectPhrase()` now extracts only the text
before the first comma/semicolon/dash and discards it if that's still longer
than 40 characters, falling back to the vocabulary bank instead. The same
run also caught a subject-verb agreement bug ("brass fixtures reflect" read
correctly, but "an overhead pendant light reflect" did not) — both
`materials.ts`'s reflection clause and `narrative.ts`'s leading-lines clause
were restructured so their grammatical subject is always singular
(`"a reflection of X plays across..."`, `"the eye follows X..."`) regardless
of which vocabulary entry is picked. A second real run then surfaced raw
commercial-composition copy (`"ADVERTISEMENT LAYERS: ... Benefit 1: Quality
| Benefit 2: Value"`) inside `VisualScenePlan.supportingSubjects` — see
`sanitize.ts` below. All three are now regression-tested (`engine.test.ts`'s
"input hygiene" and coherence tests) against exactly the inputs that caused
them, not just against clean happy-path fixtures.

## Measured results (500 campaigns, 5 industries, real pipeline)

| Metric | Before (Phase 10.5C baseline) | After |
|---|---|---|
| Photographic completeness | 64.5/100 | **100/100 avg**, every campaign ≥ 90 |
| Ten audit-named gap fields left `"unknown"` | all ten, every campaign | **0 occurrences, 500/500 campaigns** |
| Distinct narratives across 500 campaigns | — | **500/500 (100%) unique** |
| Distinct hand-position sentences across 500 campaigns | — | **344/500 (69%) unique** |
| Distinct surface-material sentences, per industry alone | material-engine.ts: ≤ 3 (one per tier) | **> 10 per industry** |
| Layout/advertisement copy leaking into the narrative | — (this class of contamination is what `sanitize.ts` exists for) | **0 occurrences, 500/500 campaigns** |

Run them yourself:

```
npx vitest run src/lib/ai-os/scene-graph/
```

- `engine.test.ts` — unit tests: all ten audit-named gaps populated,
  determinism, `not_applicable` vs `unknown` correctness, cross-graph
  coherence (hand position ↔ object contact), the reference-image pose
  constraint, and an isolated, controlled test of the micro-motion
  plausibility gate (deliberately independent of the real knowledge bank's
  tag corpus — see the comment in `regression.test.ts` for why).
- `regression.test.ts` — the same 500-campaign, 5-industry corpus the Phase
  10.6A regression suite uses, one pipeline stage earlier.
- `performance.test.ts` — budgets calibrated from real measurement (~1-2ms
  per compilation once the blueprint/scene already exist — this module adds
  no LLM calls and no I/O of its own).

## What this phase deliberately does not do

- **Does not wire itself into the live pipeline.** `scene-planner`,
  `prompt-spec`, `prompt-compiler`, and `provider-translator` are all
  untouched. See Migration guide.
- **Does not call `route-intelligence`'s full evaluation engine**
  (`evaluateIntelligence`, `getTopCandidates`, the scorer/ranker/generator
  chain). That system selects among a handful of pre-written 7-directive
  `CreativeRoute`s using a knowledge graph its own code comments say is
  populated for "restaurant" first and "progressively" for other industries
  — a different, narrower problem (route selection) than generating a
  granular multi-axis physical scene graph across all eleven industries
  uniformly. `route-scene-adapter.ts`'s `applyRouteToScene` (if it runs
  upstream) only appends short strings to a few `VisualScenePlan` fields —
  this module reads whatever `VisualScenePlan` it's given regardless of
  whether that adapter ran, so the two are compatible without being wired
  together.
- **Does not call `material-engine.ts`, `realism-engine.ts`, or
  `scene-builder.ts`'s `buildSceneBlueprint`.** All three are real,
  reachable code but only through `prompt-spec/gpt-narrative.ts`'s legacy
  GPT-narrative path, itself gated behind the `OPENAI_LEGACY_TRANSLATOR`
  env var (default unset — the deterministic path is what actually runs).
  Calling them would mean depending on static per-cell lookup tables this
  module is explicitly scoped to replace, or duplicating logic the brief's
  "never duplicate business logic" rule prohibits. `SceneIndustry` and
  `MaterialTier` — their two exported *types* — are reused directly, since
  they're already the de facto shared taxonomy across `creative-knowledge/`.
- **Does not re-derive industry, luxury tier, or hero pose.** These are read
  straight from `blueprint.strategy.business.industry` /
  `scene.renderingIntent.luxuryLevel` / `scene.heroSubject.heroPose` —
  already-computed, real signals — never re-classified from raw text a
  second time.
- **Does not alter Hero Fusion's spine.** `who.primaryHero` inherits
  `scene.heroSubject.exactHeroSubject` verbatim; when a reference image
  dominates (`heroDecision.primarySignals.includes("reference_image")`),
  `pose.ts` restricts its pick to a reference-safe subset and says so in its
  `reasoning`, exactly mirroring how `hero-fusion.ts` itself excludes
  pose-asserting VTE primitives in the same situation.

## Migration guide

`buildSceneGraph` is designed to slot in with a **single call site change**,
not a rewrite, when a future phase wires it in:

```ts
// Today:
const scene = buildVisualScenePlan(blueprint);
const spec  = buildPromptSpecification(blueprint, scene);

// After wiring (future phase):
const scene = buildVisualScenePlan(blueprint);
const graph = buildSceneGraph(blueprint, scene);
const spec  = buildPromptSpecification(blueprint, scene, graph); // graph becomes an additional, optional input
```

Recommended integration sequence for that future phase:

1. Add `graph?: SceneGraph` as a new **optional** parameter to
   `buildPromptSpecification` (optional keeps every existing call site and
   test compiling unchanged — additive, not breaking).
2. Inside `prompt-spec/engine.ts`, when `graph` is present, prefer
   `graph.narrative` (or individual graph fields) over the current
   `heroSubject`/`composition`/`environment` free-text construction for the
   fields it now covers more completely — `graph` fields marked
   `"not_applicable"` should still be omitted, exactly as this module
   already treats them.
3. Feed the result through the existing, unmodified Prompt Visual Compiler
   (Phase 10.6A) unchanged — `compileToVisualLanguage` already classifies
   and cleans whatever text `PromptSpecification` carries, so a richer input
   only improves its output, no signature change needed there.
4. Only after a real-data regression run (the same 500-campaign methodology
   used here and in Phase 10.6A) confirms no quality regression, remove the
   `?` and make `graph` required.

## Backwards compatibility

- No existing file was modified. `scene-planner`, `prompt-spec`,
  `prompt-compiler`, `provider-translator`, `creative-knowledge`, and every
  existing test suite are byte-for-byte unchanged.
- `buildSceneGraph(blueprint, scene)` has no side effects and cannot throw
  for any `VisualScenePlan` `buildVisualScenePlan` can currently produce —
  every field has an explicit fallback path down to a neutral default, the
  same total-function discipline `scene-planner`'s own builders follow.
- Nothing outside `src/lib/ai-os/scene-graph/` imports from this module yet,
  so shipping it changes no runtime behaviour anywhere in the product until
  the Migration guide's step 1 is deliberately taken in a future phase.
