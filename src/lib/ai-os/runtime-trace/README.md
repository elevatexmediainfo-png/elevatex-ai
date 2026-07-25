# Runtime Verification System — Phase 10.6D

Proves, from real execution data — not assumptions, not synthetic fixtures —
that Scene Graph and the Prompt Visual Compiler actually influence the final
Provider Prompt. Phase 10.6C wired both into the live pipeline; this module
watches that pipeline run and reports exactly what happened.

## Position in the pipeline

This module **observes** the pipeline; it does not sit inside its data flow.
Every existing function call in `enhance-prompt/route.ts` is wrapped with a
timing measurement (`timed()`) and fed into a trace builder — the call
itself, its arguments, and its return value are completely unchanged.

```
Creative Brain
      │  timed() wraps the existing call — no behaviour change
      ▼
Scene Planner
      │
      ▼
Scene Graph Compiler
      │
      ▼
Prompt Specification
      │
      ▼
Prompt Visual Compiler
      │
      ▼
Prompt Optimizer
      │
      ▼
Provider Translator  ──► Final Provider Prompt
      │
      ▼
[ Runtime Trace: ExecutionTree → RuntimeReport → ProviderReport (4 providers)
  → InfluenceGraph → RuntimeVerificationReport (6 named graphs) ]
```

No code redesign, no architecture redesign — every measurement in this
module is derived from objects the pipeline already produces.

## Why the numbers can be trusted

Every metric in this module traces back to one of three sources, never a
fabricated or assumed value:

1. **Direct reads of already-computed fields** — `CreativeStrategy.confidenceScore`,
   `SceneGraph.meta.completenessScore`, `CompiledPrompt.report.bannedTermsRemoved`,
   `OptimizedPromptSpecification.duplicates.totalFound`, and so on. Nothing here
   is recomputed; it's read directly off the object the real stage produced.
2. **Reused measurement methodology** — token count / visual token ratio /
   abstract token ratio reuse Phase 10.6A's own `measurePrompt()` (proven
   against 500 real campaigns in `prompt-compiler/regression.test.ts`); enum
   leakage reuses `countEnumLeaks()`. This module does not invent a second,
   competing definition of "visual" for the same text.
3. **Independently re-verifiable cross-checks** — `detectSceneGraphConsumption()`
   does not trust the "Scene Graph ..." marker Phase 10.6C's builders already
   write into a field's `reasoning` string; it separately confirms the exact
   Scene Graph source *value* is present as a substring of the
   PromptSpecification field it is claimed to feed. The Influence Graph's
   sentence attribution is checked the same way in every regression test:
   every edge's `sentence` must be a literal substring of the real final
   prompt (`pipeline-regression.test.ts`'s "every influence graph edge's
   sentence is a real, independently-verifiable substring" — 500/500 campaigns).

Where a metric is structurally inapplicable to a stage (e.g. "field diff"
between `CreativeContext` and `CreativeStrategy` — two unrelated shapes), the
trace says so explicitly via `fieldDiff.note` rather than fabricating a
number. See `stage-tracer.ts`'s per-stage `record*` methods for exactly which
metrics apply where and why.

## The 7 traced stages

| Stage | Real function(s) traced | What's measured that's specific to it |
|---|---|---|
| `creative-brain` | `buildCreativeStrategy` | confidence score, unknown-field count |
| `scene-planner` | `buildVisualScenePlan` | confidence score, unknown-field count |
| `scene-graph-compiler` | `buildSceneGraph` | completeness score (the same checklist the Phase 10.5C audit measured at 64.5/100) |
| `prompt-specification` | `buildPromptSpecification` | **Scene Graph usage** — `detectSceneGraphConsumption()`, cross-verified against real field values |
| `prompt-visual-compiler` | `compileToVisualLanguage` + `applyCompiledPrompt` | real `FieldDiff` (added/removed/modified — same-shaped before/after), duplicate removals, concept-translation count, **Prompt Compiler usage** |
| `prompt-optimizer` | `optimizePromptSpecification` | real `FieldDiff` (compression), duplicate/conflict counts |
| `provider-translator` | `translateForProvider` | re-verifies which upstream-confirmed Scene-Graph/Compiler fields *survived* this specific translator's own length caps |

"Final Provider Prompt" is not an 8th traced function call (there is no
function that produces it beyond the translator) — it is the tree's
`finalPrompt` leaf value.

## Provenance: the exact Scene Graph → Prompt Specification wiring

`provenance.ts` hard-codes the 7 fields Phase 10.6C actually wired (see that
phase's own entry in `PROJECT_STATUS.md`) — this is metadata *about* the
integration, kept deliberately separate from a second copy of the
integration's logic:

| PromptSpecification field | Scene Graph source(s) |
|---|---|
| `hero.heroDetails` | `pose.secondaryAction`, `body.headDirection`, `body.eyeDirection`, `body.handPosition` |
| `supporting.relationships` | `objectContact.contactDescription`, `objectContact.secondaryContact` |
| `environment.premiumDetails` | `materials.architectureMaterial`, `materials.surfaceMaterial`, `materials.reflection` |
| `composition.background` | `where.background` |
| `composition.foreground` | `where.foreground` |
| `composition.midground` | `where.midground` |
| `camera.cameraPosition` | `camera.occlusion`, `camera.leadingLines`, `camera.focusPlane` |

If a future phase changes which builders Scene Graph feeds, this table must
change with it — `SCENE_GRAPH_WIRED_SPEC_FIELDS` (exported) is the single
source of truth the Dependency Graph and Influence Graph both read from.

## Runtime Report

Aggregates across all 7 stages (`report.ts`):

- `sceneGraphFieldsConsumed` — Scene Graph field paths confirmed contributing, anywhere in the run
- `promptCompilerFieldsConsumed` — PromptSpecification field paths the compiler classified A/B and rewrote
- `promptSpecificationFieldsSkipped` — fields classified C (business-only, removed) or E (internal metadata)
- `duplicateRemovals` — summed across every stage that removes duplicates (compiler + optimizer)
- `businessLanguageRemoved` — `CompiledPrompt.report.bannedTermsRemoved`, read directly
- `visualLanguageAdded` — count of A/B-classified fields
- `providerSpecificTransformations` — one real, data-derived sentence per provider (format style, char delta vs. compiledText, duplicate/enum-leak counts) — not a hardcoded description list

## Per-provider report (all 4 named providers)

`buildProviderReport()` translates the **same already-optimized spec**
against OpenAI, Gemini, Flux, and Stable Diffusion (SDXL) purely for this
report — it does not change what the live route returns as its primary
result, which remains exactly the one resolved `translationTarget`
translation. This is cheap by construction: Phase 10.6C's own performance
suite already proved translating for all 4 providers combined costs well
under the budget of a single upstream stage.

For each provider: final prompt length, visual/abstract token ratio, enum
leakage, duplicate ratio, and two coverage numbers — the share of
Scene-Graph-sourced (respectively Compiler-sourced) PromptSpecification
field values that survived as a substring into *that specific* provider's
final prompt. Coverage is re-verified per provider rather than assumed
uniform, because a translator's own character-limit truncation can drop a
field an earlier stage legitimately produced (Flux and SDXL cap around
400-512 chars; OpenAI and Gemini do not).

## Influence Graph — sentence-level provenance

For one provider's final prompt: splits it into sentences, and for each one
finds the PromptSpecification field it most overlaps (significant-word
overlap — the same technique already used elsewhere in this codebase for
near-duplicate detection, e.g. `hero-fusion.ts`'s `overlapsExisting`). Once a
field is matched, its Prompt Visual Compiler classification (A/B/C/D/E) and —
when the field is one of the 7 Scene-Graph-wired fields — its Scene Graph
source path(s) are attached. A sentence with no confident match (typically a
translator's own hardcoded vocabulary: quality boosters, `AVOID:` lists,
`openai/translator.ts`'s literal `"CAMPAIGN THEME"`/`"MARKETING INTENT"`
block headers) is reported as unattributed, not force-matched — the same
"no assumptions" discipline this whole module holds itself to.

## The 6 named graphs

All 6 are projections over the *same* `ExecutionTree` + provider/influence
data — nothing is measured twice under a different name:

| Graph | Content |
|---|---|
| **Runtime Graph** | The full per-stage trace: inputs, outputs, every metric |
| **Dependency Graph** | Stage-to-stage structural edges + the 7-field Scene Graph → Prompt Specification field dependency table |
| **Influence Graph** | Sentence-level provenance for the resolved provider |
| **Execution Graph** | Stage call order + per-stage timing, as a DAG |
| **Provider Graph** | The 4-provider comparison table |
| **Performance Graph** | Total time, per-stage breakdown, slowest/fastest stage |

## Wiring into the live route

`enhance-prompt/route.ts`'s modern path (`providerPromptEnabled` branch) is
the only call site. Every existing pipeline call is now wrapped:

```ts
const scenePlannerTimed = timed(() => buildVisualScenePlan(universalBlueprint));
visualScenePlan = scenePlannerTimed.result;               // unchanged value
tracer.recordScenePlanner(universalBlueprint, visualScenePlan, scenePlannerTimed.elapsedMs);
```

`timed()` measures elapsed time around the existing call and returns
`{ result, elapsedMs }` — `result` is exactly what the un-wrapped call would
have returned. The API response gains two new additive, `null`-on-legacy-path
fields, following the exact pattern every prior Phase 10.6 sub-phase used for
its own debug fields: `sceneGraph`, `compiledPrompt`, and now
`runtimeVerification`.

## What this phase deliberately does not do

- **Does not change what any stage computes.** Every `record*` call wraps an
  existing, unmodified function call. `timed()` is a pure pass-through.
- **Does not change the primary API result.** `enhancedPrompt` /
  `providerPrompt` are still exactly the one resolved provider's translation;
  the 4-provider comparison is a separate, additive report field.
- **Does not touch `prompt-optimizer/` or `provider-translator/`.** All
  analysis is external — reading their output objects, never modifying their
  source.
- **Does not force sentence attribution.** A sentence the Influence Graph
  can't confidently trace back to a spec field is reported as unattributed,
  not guessed at.

## Measured results (500 campaigns, 5 industries, real pipeline)

| Check | Result |
|---|---|
| Campaigns traced without throwing | 500/500 |
| Execution trees with exactly 7 stages, all non-negative timing | 500/500 |
| Scene Graph consumption confirmed at the Prompt Specification stage | 500/500 |
| Influence graph edges independently re-verified as real substrings of the final prompt | 100% of edges, all 500 campaigns |
| Final reports containing all 6 named graphs, non-empty | 500/500 |
| Average Scene Graph fields consumed per campaign | 21.7 |
| Average Prompt Compiler fields consumed per campaign | 51.5 |
| Average total traced execution time | ~54ms (negligible next to a real image-generation call's 5-30+ second latency) |

All 4 named providers additionally verified across one representative
campaign per industry (20 provider×industry combinations) with coverage/
duplicate-ratio metrics confirmed in-range.

## Running the tests

```
npx vitest run src/lib/ai-os/runtime-trace/
```

- `engine.test.ts` — unit tests for every utility (`field-diff`,
  `text-analysis`, `provenance`) plus a full traced-pipeline integration
  suite against real (not synthetic) campaign data, including a test that
  independently re-derives Scene Graph consumption via `JSON.stringify`
  substring search rather than trusting the trace's own claim.
- `regression.test.ts` — the same 500-campaign, 5-industry corpus every
  prior Phase 10.6 sub-phase used, traced end-to-end, plus a 4-provider ×
  5-industry cross-check.
- `performance.test.ts` — tracing overhead, best-of-5-trials (the same
  de-noising technique adopted in Phase 10.6C after single-shot wall-clock
  samples proved too exposed to scheduler jitter under full-suite parallel
  test execution).

## A real bug this phase's own tests caught

`buildProviderReport`'s second and third parameters were named
`sceneGraphFieldsConsumed` / `compilerFieldsConsumed` — the same name
`RuntimeReport.sceneGraphFieldsConsumed` uses for a *different* thing (Scene
Graph's own field paths, e.g. `"pose.secondaryAction"`, vs. the
PromptSpecification-side paths `buildProviderReport` actually needs to look
values up, e.g. `"hero.heroDetails"`). A determinism test that rebuilt a
provider report from the trace's own reported field list silently passed the
wrong list, which `getSpecValue()` failed to resolve for every path (no
matching section), producing a real but misleading discrepancy. Fixed by
renaming the parameters (`sceneGraphSourcedSpecFields` /
`compilerSourcedSpecFields`) and documenting the distinction in both the
JSDoc and this README, rather than only patching the one call site that
happened to catch it.
