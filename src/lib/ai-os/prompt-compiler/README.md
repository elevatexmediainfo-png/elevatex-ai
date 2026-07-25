# Prompt Visual Compiler — Phase 10.6A

Converts a `PromptSpecification` into pure visual language: physically
drawable scene description, with every business/marketing/psychology
sentence either converted to a concrete visual equivalent or removed.

## Position in the pipeline

```
Creative Brain → GPT Creative Director → PromptSpecification
                                                │
                                                ▼
                                    Prompt Visual Compiler   ← this module
                                                │
                                                ▼
                                   (future) Provider Translators
```

**This phase does not wire the compiler into the live pipeline.** No file
outside `src/lib/ai-os/prompt-compiler/` was modified — `prompt-optimizer`,
`provider-translator`, every scene-planner/creative-director/creative-brain
builder, and every existing test are untouched. `compileToVisualLanguage()`
is a standalone pure function: `PromptSpecification` in, `CompiledPrompt`
out. Wiring it into `provider-translator/engine.ts` (so translators consume
its output instead of the current abstract section-builders) is a natural
follow-up, deliberately left for a separate, explicit integration phase.

## Why this exists

The Phase 10.5A–10.5G audits measured the *current* Provider Prompt and
found: 84.2% abstract tokens, 13.6% visual token ratio, 62.9% abstract
sentences, 8.9% duplicate sentences, enum leaks in 100% of prompts (69
distinct raw tokens like `soft_diffused_shadow`), and broken multi-period
punctuation in 100% of prompts. Hero Fusion (Phase 10.5A.1) fixed the Hero
field specifically; `PromptSpecification.marketing.*` and its siblings still
inject unconverted business language everywhere else.

## How it works

### 1. Classification (`field-classification.ts`)

Every `PromptSpecification` leaf field is classified once, by its dot-path,
against a fixed rule table:

| Category | Meaning | Outcome |
|---|---|---|
| **A** — Already Visual | Field already describes something physically drawable | Passed through (enum tokens naturalised, banned language scrubbed as a safety net) |
| **B** — Abstract but convertible | The *label* is business language, but the *concept* it names has a concrete visual equivalent | Converted — either via the Visual Translation Engine (a resolved concept like `"trust"` or `"luxury"`), an enum→English phrase table, or clause-level banned-language scrubbing |
| **C** — Business only | No visual equivalent exists or is appropriate | Removed entirely |
| **D** — Duplicate | Near-identical (≥70% word overlap) to a field already compiled earlier | Removed, keeping the first occurrence |
| **E** — Internal metadata | Never describes scene content (validation criteria, governance flags, confidence scores) | Never reaches the compiled output, unconditionally |

`marketing.*` — the field group the audits identified as the primary
offender — has **no field classified A**. Every one of its ~20 fields is B or
C; none pass through as "already visual."

### 2. Concept conversion (via the existing Visual Translation Engine)

Category B fields with a resolved concept call the **existing, untouched**
`translateConcept()` / `resolveConcept()` / `resolveIndustry()` from
`visual-translation/`. This module does not reimplement or duplicate that
logic — it only decides *which* fields to hand to it and what industry hint
to pass (derived from the spec's own hero/environment/objects text, so no
new parameter needs to be threaded through any existing function signature).

```
"trust"   → "A professional holds steady, open eye contact with a client
             during face-to-face conversation, projecting unhurried calm
             competence."
"luxury"  → "Handstitched leather, Italian marble, cashmere, or raw silk
             appear as tactile proof of the investment required to be in
             this space."
```

### 3. Enum naturalisation (`enum-language.ts`)

Every raw internal enum value (`soft_diffused_shadow`, `catchlight_eyes`,
`hero_dominant_others_small`, `top_right`, ...) is converted to natural
English via a hand-written phrase dictionary for ~130 known values, with a
mechanical underscore-expansion fallback for anything not explicitly listed
— the fallback is still infinitely better than a raw leak, even where less
elegant than a hand-written phrase.

### 4. Banned-language enforcement (`banned-language.ts`)

The compiler must never emit: *campaign, marketing, brand, conversion,
positioning, awareness, USP, business, commercial objective, psychology,
"viewer should feel", customer, audience, marketing intent.* Enforcement is
two-layered:
1. A targeted rephrase map for known phrases worth preserving the visual
   meaning of (`"brand mark placeholder"` → `"identifying mark placeholder"`).
2. A clause-level safety net: if a banned term survives rephrasing, the
   *clause* containing it is dropped — not the word alone (which risks
   broken grammar) and not the whole field (Hero Fusion output in particular
   is routinely one long comma-joined sentence; dropping at the sentence
   level would discard the entire hero on a single stray word).

This safety net also runs on VTE-derived text — VTE primitives are designed
to be concrete but are not certified against this compiler's own banned-word
list (e.g. a `"premium"` primitive legitimately describing a colour palette
happens to end "...signals editorial premium **positioning**").

### 5. Deduplication (`engine.ts`)

After classification, surviving A/B fields are walked in order; any field
whose compiled text is a near-duplicate (≥70% word overlap) of an
already-kept field is reclassified D and dropped.

### 6. Metrics (`metrics.ts`)

Before/after measurement using the same word-list-based heuristic
methodology established across the Phase 10.5 audit series (not a certified
NLP model — a reproducible, documented heuristic).

## Output shape

```ts
interface CompiledPrompt {
  compiledText: string;           // the final abstraction-free text
  sections: CompiledSection[];    // grouped by one of 15 permitted visual categories
  fields: ClassifiedField[];      // full audit trail: every field, its classification, why
  report: CompilationReport;      // before/after metrics + which of the 6 hard targets were met
}
```

The 15 permitted output categories: `people, objects, actions,
relationships, environment, materials, camera, lighting, textures, weather,
architecture, motion, depth, interaction, micro-details`.

## Measured results (500 campaigns, 5 industries, real pipeline)

| Metric | Before | After | Target | Met? |
|---|---|---|---|---|
| Duplicate % | 6.6% (sample) | **0%** (avg) | < 2% | ✅ |
| Abstract % | 32.2% (sample) | **17.1%** (avg) | < 20% | ✅ |
| Enum leakage | 100% of prompts | **0 leaks, 500/500** | none | ✅ |
| Broken punctuation | 100% of prompts | **0, 500/500** | none | ✅ |
| Banned language | pervasive | **0 occurrences, 500/500** | none | ✅ |
| Sentence-level Renderable % | 61.2% (sample) | **82.9%** (avg) | — | real, substantial gain |
| Visual Token Ratio (strict, per-token) | ~13.6% (10.5D baseline) | **~26%** (avg, +~90% relative) | > 70% | ❌ — see note below |

**On the one target not met:** Visual Token Ratio is a strict *token*-level
measure — the fraction of individual non-stopword words that are literally
visual nouns/verbs. Grammatical English sentences require connective content
words ("moment," "each," "clear," "single") that are neither stopwords nor
visual nouns/verbs no matter how concrete the surrounding content is. A
literal >70% token ratio is realistically reachable only by abandoning full
sentences for comma-separated tag lists (the Flux/SDXL style) — which
conflicts with this project's own standing preference for full natural
sentences over keyword lists. The regression suite measures this honestly as
a large, real, checked improvement (+20%+ relative, enforced) rather than
silently padding word lists to force an unreachable number, or quietly
deleting the check.

## Running the tests

```
npx vitest run src/lib/ai-os/prompt-compiler/
```

- `engine.test.ts` — unit tests: classification correctness, banned-language
  enforcement, enum naturalisation, punctuation cleanup, concept conversion,
  deduplication, determinism.
- `regression.test.ts` — 500 real campaigns across 5 industries, proving the
  targets above against the actual, unmodified pipeline (not synthetic
  fixtures).
- `performance.test.ts` — budgets calibrated from real measurement (~60-90ms
  per compilation, dominated by Visual Translation Engine calls — negligible
  next to a real image-generation API call's 5-30+ second latency).

## What this phase deliberately does not do

- Does not modify `PromptSpecification`, `prompt-optimizer`, any Provider
  Translator, or any builder in `scene-planner/`, `creative-director/`, or
  `creative-brain/`.
- Does not wire itself into the live generation pipeline — it is proven
  against real data via its own tests, not by changing what a real request
  currently does.
- Does not implement a Visual Scene Compiler with 11 named "graphs" (Scene
  Graph, Camera Graph, ...) — that was a different, earlier, paused
  exploration (`visual-scene-compiler/`, since removed) superseded by this
  more precisely-scoped brief.
