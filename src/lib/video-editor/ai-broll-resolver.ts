import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { searchStockMedia, materializeStockAsset, type StockSearchProviderOutcome } from "@/lib/providers/stock-media/search-service";
import type { StockSearchResult } from "@/lib/providers/stock-media/types";
import { generateImageThumbnail, generateVideoThumbnail } from "./thumbnails";
import { generateImage } from "@/lib/generation/image";
import { renderVideo } from "@/lib/generation/video";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";
import { logger } from "@/lib/observability/logger";
import type { AIBroll } from "@/lib/validations/ai-timeline";

// Phase 12 Module 5 (AI Auto-Editor) — resolves each broll slot GPT-5.x
// proposed (Module 4's TASK 3) into a real, placeable EditorAsset. Two
// paths, mirroring the SAME "generic providers already exist, reuse
// them" investigation finding that motivated this whole module: stock
// resolution reuses Module 11's real searchStockMedia/materializeStockAsset
// verbatim; generation resolution reuses the app's existing, already-
// production-live generateImage()/renderVideo() Generation Engine
// wrappers (used today by Marketing Creative/AI Image/AI Film) with two
// new operation literals — NOT a new adapter, since real image/video
// generation adapters already existed in this codebase before Phase 12
// ever started (confirmed via investigation: openai_images/flux/
// ideogram/gemini_images/imagen for IMAGE, replicate/veo/kling/hailuo/
// runway/sora/seedance2 for VIDEO — all real, live-tested vendor calls).
//
// Every resolution is independently try/caught HERE, never left to throw
// up into the caller — one broll item failing to resolve (no stock
// match, generation unavailable/erroring) must never take down the
// other items or the whole job. Failure is recorded via `resolutionNote`
// (aiBrollSchema, Module 5) so the review UI can flag it distinctly
// rather than the item just silently vanishing.

export interface BrollResolutionContext {
  userId: string;
  aspectRatio: "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";
  // Founder policy (2026-07-18) — see AiEditJob.brollStockOnly's own doc
  // comment (prisma/schema.prisma). This is the HARD enforcement point:
  // the reasoning prompt also tells the model to always propose "stock"
  // (gpt5.provider.ts's stockOnlyGuidance), but that's advisory — this
  // flag makes the resolver itself ignore `item.source` and always try
  // stock first when true, regardless of what the model actually
  // returned, so the policy holds even against a model that doesn't
  // comply. Generation only fires as an absolute last resort, when stock
  // (every enabled provider, searchStockMedia's own exhaustive fan-out)
  // returns literally nothing usable for that slot.
  stockOnly: boolean;
  // Founder policy follow-up (2026-07-23) — see AiEditJob.brollRelevanceFallbackThreshold's
  // own doc comment (prisma/schema.prisma). Only consulted when stockOnly
  // is true: if the best stock match's relevanceScore falls below this,
  // resolveStockBroll treats it the same as "no usable match," letting
  // resolveBrollItem's existing stockOnly fallback-to-generation branch
  // handle it — no separate fallback path needed.
  relevanceFallbackThreshold: number;
}

// Pure and independently testable. This is Module 5's own "best match"
// heuristic: prefer a result whose kind matches the caller's preference
// (b-roll: VIDEO over IMAGE; stickers: ICON/IMAGE; music/sfx: AUDIO) as a
// TIEBREAKER, and if genuinely nothing of the preferred kind exists at all,
// the best-ranked result of ANY kind still resolves the slot rather than
// leaving it unresolved for want of the preferred kind. Reused by
// ai-asset-resolver.ts (Module 6, stickers/music/sfx) and ai-reedit.ts
// (Module 9, change_asset) as well as broll — one scoring rule, not a
// parallel reimplementation per section.
//
// B1 investigation (2026-07-22) — this used to trust each provider's OWN
// rank blindly within a kind (index 0 always won), with zero use of the
// search query itself. Two real live failures this way: "automatic water
// pump" resolved to an unrelated construction "concrete_pump" clip, and
// "water conservation" resolved to an orca whale clip (matched only on the
// stray word "water"). First fix attempt scored kind-match as a fixed
// +1000 "gate" ahead of relevance — but live-verifying against the REAL
// provider APIs (not just synthetic unit tests) showed that still failed
// "automatic water pump": every VIDEO result only weakly matched (one of
// three query words), while several IMAGE results were a strong match (two
// of three words, an actual water pump) — the +1000 gate let the weak
// video always beat the strong image regardless. Fixed by making relevance
// the dominant signal (weighted 0-1000, i.e. it can outrank a kind
// mismatch when the gap is real) and kind-match a small +50 tiebreak that
// only matters between otherwise-equally-relevant candidates; vendor index
// remains the last-resort tiebreak below that.
interface ScoredStockResult {
  providerId: string;
  result: StockSearchResult;
  score: number;
  relevanceScore: number;
}

const STOPWORDS = new Set(["a", "an", "the", "of", "in", "on", "at", "for", "with", "and", "to", "is", "this", "that"]);

// Quality upgrade (2026-08-07, TASK 3 — "rank them, choose the highest
// quality result") — how many of the AI's own ranked searchQueries are
// searched IN PARALLEL and compared for the single best-scoring match,
// before falling back to trying the rest sequentially. Bounded well below
// the schema's own max(10) to keep real vendor-API fan-out proportionate
// per b-roll item.
const EXPANSION_PARALLEL_SEARCH_COUNT = 4;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

// Semantic upgrade (2026-08-08, "instead of exact token overlap, use
// semantic similarity") — a small, curated, deterministic synonym table
// (no embeddings/API call, per this fix's own "no new AI calls" rule): a
// query token with no LITERAL match can still be a genuine conceptual
// match against the candidate's title via a same-topic synonym. Weighted
// at half an exact match (see relevanceScore below) so it can meaningfully
// lift a real near-miss without ever letting synonym-only overlap alone
// outscore a genuinely literal match — deliberately scoped to the same
// real-world topic areas the Hinglish visual-concept map in
// director/visual-coverage.ts covers (home, finance, health, business,
// education, food, travel, wedding, career, fashion, tech, auto, family),
// not an attempt at a general thesaurus.
const SEMANTIC_SYNONYM_GROUPS: string[][] = [
  ["house", "home", "building", "construction", "residence"],
  ["money", "finance", "cash", "investment", "banking", "savings"],
  ["doctor", "medical", "healthcare", "hospital", "clinic", "physician"],
  ["office", "business", "workplace", "corporate", "company"],
  ["team", "teamwork", "collaboration", "colleagues"],
  ["meeting", "discussion", "conference"],
  ["school", "education", "classroom", "student", "learning"],
  ["food", "cooking", "kitchen", "meal", "cuisine"],
  ["travel", "tourism", "vacation", "trip", "journey"],
  ["wedding", "marriage", "bride", "groom", "ceremony"],
  ["technology", "digital", "tech", "gadget", "device"],
  ["car", "vehicle", "automobile", "driving"],
  ["family", "parents", "children"],
  ["fitness", "exercise", "workout", "gym", "health"],
  ["fashion", "clothing", "style", "outfit"],
];
const SYNONYM_LOOKUP = new Map<string, Set<string>>();
for (const group of SEMANTIC_SYNONYM_GROUPS) {
  const set = new Set(group);
  for (const word of group) SYNONYM_LOOKUP.set(word, set);
}

// 0..1: the query's own meaningful tokens, matched against the
// candidate's title/tag text either LITERALLY (full weight) or via the
// synonym table above (half weight) — deliberately simple, no external
// NLP/embedding dependency, since these titles are themselves just
// keyword lists, not sentences a semantic model would help with.
function relevanceScore(query: string, title: string): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;
  const titleTokens = new Set(tokenize(title));

  let exactMatches = 0;
  let softMatches = 0;
  for (const token of queryTokens) {
    if (titleTokens.has(token)) {
      exactMatches += 1;
      continue;
    }
    const synonyms = SYNONYM_LOOKUP.get(token);
    if (!synonyms) continue;
    for (const titleToken of titleTokens) {
      if (synonyms.has(titleToken)) {
        softMatches += 1;
        break;
      }
    }
  }
  return Math.min(1, (exactMatches + softMatches * 0.5) / queryTokens.length);
}

// `relevanceScore` (2026-07-23) — the winning candidate's own 0..1 token-
// overlap score, exposed so callers can decide whether a "best available"
// match is actually good enough (see BrollResolutionContext.relevanceFallbackThreshold)
// rather than just trusting that SOME result was returned.
//
// `preferPortrait` (2026-08-07) — a small scoring bonus (below the kind
// bonus, so it only breaks ties between otherwise-similar matches, never
// overrides genuine relevance) for a portrait-oriented result
// (heightPx > widthPx) when the project being edited is itself portrait
// (RATIO_9_16 — Reels/Shorts/TikTok). A landscape clip letterboxed into a
// 9:16 canvas reads as visibly lower-quality than a real portrait shot.
// `excludeExternalIds` (2026-08-07) — "never reuse the exact same stock
// clip multiple times": candidates already claimed by an earlier b-roll
// slot in this same job are filtered out entirely before scoring, keyed
// by `${providerId}:${externalId}` (the one identifier that's stable
// PRE-materialization — resolvedAssetId is a NEW EditorAsset minted per
// materialize call, even for the identical source clip, so it can't be
// used to detect a repeat).
// Polish pass (2026-08-07, "reject low-quality stock footage") — a soft
// penalty, not a hard filter: a candidate whose SMALLER dimension falls
// below a real-HD bar loses to an otherwise-similar higher-resolution
// candidate, but a low-res result is still better than leaving a b-roll
// slot completely empty (this codebase's own established "never leave a
// slot empty over a soft quality concern" principle — see FIX 4's own
// doc comment just below for the identical reasoning applied to
// relevance). Scaled to roughly the same magnitude as kindBonus (50) so
// a genuinely more-relevant low-res result can still beat an irrelevant
// high-res one — relevance stays dominant, resolution is a real but
// secondary signal, exactly like the portrait bonus already is.
const MIN_QUALITY_DIMENSION_PX = 720;
const MAX_QUALITY_PENALTY = 40;

function qualityPenalty(widthPx: number | undefined, heightPx: number | undefined): number {
  if (!widthPx || !heightPx) return 0; // unknown dimensions — never penalize what we can't measure
  const smaller = Math.min(widthPx, heightPx);
  if (smaller >= MIN_QUALITY_DIMENSION_PX) return 0;
  return -MAX_QUALITY_PENALTY * (1 - smaller / MIN_QUALITY_DIMENSION_PX);
}

export function pickBestStockResult(
  outcomes: StockSearchProviderOutcome[],
  preferredKind: StockSearchResult["kind"],
  query: string,
  options: { preferPortrait?: boolean; excludeExternalIds?: Set<string> } = {}
): { providerId: string; result: StockSearchResult; relevanceScore: number } | null {
  const candidates: ScoredStockResult[] = [];
  for (const outcome of outcomes) {
    if (outcome.error) continue;
    outcome.results.forEach((result, index) => {
      if (options.excludeExternalIds?.has(`${outcome.providerId}:${result.externalId}`)) return;
      const relevance = relevanceScore(query, result.title);
      const kindBonus = result.kind === preferredKind ? 50 : 0;
      const portraitBonus = options.preferPortrait && result.widthPx && result.heightPx && result.heightPx > result.widthPx ? 10 : 0;
      const resolutionPenalty = qualityPenalty(result.widthPx, result.heightPx);
      candidates.push({ providerId: outcome.providerId, result, score: relevance * 1000 + kindBonus + portraitBonus + resolutionPenalty - index, relevanceScore: relevance });
    });
  }
  if (candidates.length === 0) return null;
  const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
  return { providerId: best.providerId, result: best.result, relevanceScore: best.relevanceScore };
}

// Fix (2026-08-06, FIX 4 — "never leave B-roll empty if stock footage
// exists") — a short, over-specific query (multiple qualifying words
// stacked onto one core noun, e.g. "domestic water pump appliance") can
// genuinely return zero results from a keyword-matching stock library
// even when a broader phrasing of the SAME idea would find something
// usable. This progressively widens the SEARCH TEXT only — relevance is
// always scored against the ORIGINAL query (see resolveStockBroll below),
// so broadening increases recall without ever inflating the quality score
// of what it finds. Order: (1) the original query itself, (2) the same
// query with stopwords stripped (reuses this file's own STOPWORDS set —
// no separate list), (3) progressively fewer tokens, dropped from the
// FRONT one at a time (the least-specific/qualifying position in these
// short "adjective(s) + core noun" phrases this app's own prompt asks
// GPT for — see gpt5.provider.ts's TASK 3), down to the single last token.
export function buildBroadenedQueries(query: string): string[] {
  const trimmed = query.trim();
  const allTokens = trimmed.split(/\s+/).filter(Boolean);
  if (allTokens.length <= 1) return [trimmed];

  const queries = [trimmed];
  const meaningfulTokens = allTokens.filter((t) => !STOPWORDS.has(t.toLowerCase()));
  const stopwordStripped = meaningfulTokens.join(" ");
  if (stopwordStripped && stopwordStripped.toLowerCase() !== trimmed.toLowerCase()) {
    queries.push(stopwordStripped);
  }
  for (let dropCount = 1; dropCount < meaningfulTokens.length; dropCount++) {
    const narrowed = meaningfulTokens.slice(dropCount).join(" ");
    if (narrowed && !queries.includes(narrowed)) queries.push(narrowed);
  }
  return queries;
}

// `queryOverride` (2026-07-18, stock-only policy) — lets the stock-only
// hard-enforcement path in resolveBrollItem search stock even for an item
// GPT proposed as "generate" (which has no searchQuery of its own),
// falling back to the generation prompt's own text as a literal search
// phrase. Plain `item.searchQuery` is used when no override is given —
// unchanged behavior for the normal, non-override call site below.
//
// `minRelevanceScore` (2026-07-23) — only ever passed by resolveBrollItem's
// stockOnly branch (see BrollResolutionContext.relevanceFallbackThreshold's
// own doc comment). When set and the best pick's own relevanceScore falls
// below it, this returns the SAME "no usable match" shape as the
// zero-results case above, deliberately — resolveBrollItem's existing
// stockOnly fallback-to-generation branch already treats "no
// resolvedAssetId" as its trigger, so a low-relevance match and a missing
// one are handled identically with no new branching there.
async function resolveStockBroll(
  item: AIBroll,
  ctx: BrollResolutionContext,
  queryOverride?: string,
  minRelevanceScore?: number,
  usedExternalIds?: Set<string>
): Promise<AIBroll> {
  const queryOrUndefined = queryOverride ?? item.searchQuery;
  if (!queryOrUndefined) return { ...item, resolutionNote: 'source:"stock" but no searchQuery was provided.' };
  // Re-bound to a plain `string` const — TypeScript's control-flow
  // narrowing from the guard above doesn't propagate into the nested
  // `searchAndPick` function declaration below (a closure over a
  // differently-named outer binding), so this makes the non-optional type
  // explicit rather than fighting the narrowing.
  const query: string = queryOrUndefined;
  const preferPortrait = ctx.aspectRatio === "RATIO_9_16";

  async function searchAndPick(searchText: string) {
    // Search both kinds in parallel — b-roll is conventionally VIDEO
    // footage, but a well-matched IMAGE is a real, usable fallback when no
    // video result exists for this specific query (see pickBestStockResult).
    const [videoOutcomes, imageOutcomes] = await Promise.all([
      searchStockMedia("STOCK_MEDIA", searchText, { type: "video", perPage: 5 }),
      searchStockMedia("STOCK_MEDIA", searchText, { type: "image", perPage: 5 }),
    ]);
    // Relevance is ALWAYS scored against the ORIGINAL query (`query`),
    // never `searchText` — see buildBroadenedQueries' own doc comment.
    return pickBestStockResult([...videoOutcomes.outcomes, ...imageOutcomes.outcomes], "VIDEO", query, { preferPortrait, excludeExternalIds: usedExternalIds });
  }

  let picked = await searchAndPick(query);
  let searchedWith = query;

  // Query expansion (2026-08-07, extended 2026-08-07 "TASK 3 — rank them,
  // choose the highest quality result") — semantic/synonym/category
  // variants of the primary query (item.searchQueries, aiBrollSchema's own
  // doc comment), the AI's own ranked (best-to-worst) list. A TOP SLICE of
  // them (EXPANSION_PARALLEL_SEARCH_COUNT, ranked-best-first) is searched
  // IN PARALLEL and the single highest-SCORING candidate across the whole
  // slice wins — not just whichever query happened to return something
  // first. This is a genuine "rank, then choose best" step, not a
  // sequential "first success wins" one: a lower-ranked query occasionally
  // surfaces a more relevant/higher-quality (portrait/video-kind-bonused)
  // match than a higher-ranked one whose own stock coverage happens to be
  // thin, and this now catches that instead of settling for whichever
  // query was tried first. Bounded to a small slice (not all 10) to keep
  // real vendor-API load proportionate — this is stock-search cost, not
  // LLM cost, but an unbounded fan-out per b-roll item is still real
  // infrastructure load this app pays for. The full ranked list remains
  // available for the "found literally nothing" fallback loop below.
  if ((!picked || (usedExternalIds && picked)) && item.searchQueries && item.searchQueries.length > 0) {
    const ranked = item.searchQueries.filter((q) => q.trim().toLowerCase() !== query.trim().toLowerCase());
    const parallelSlice = ranked.slice(0, EXPANSION_PARALLEL_SEARCH_COUNT);
    const results = await Promise.all(parallelSlice.map(async (expanded) => ({ expanded, candidate: await searchAndPick(expanded) })));
    const scored = results.filter((r): r is { expanded: string; candidate: NonNullable<(typeof results)[number]["candidate"]> } => r.candidate !== null);
    if (scored.length > 0) {
      const best = scored.reduce((a, b) => (b.candidate.relevanceScore > a.candidate.relevanceScore ? b : a));
      picked = best.candidate;
      searchedWith = best.expanded;
    } else {
      // Nothing in the top-ranked parallel slice found ANYTHING — fall
      // back to the remaining, lower-ranked queries sequentially (same
      // "keep trying until something works" coverage as before this
      // parallel-ranking upgrade, just only reached when the best-ranked
      // candidates genuinely came up empty).
      for (const expanded of ranked.slice(EXPANSION_PARALLEL_SEARCH_COUNT)) {
        const candidate = await searchAndPick(expanded);
        if (candidate) {
          picked = candidate;
          searchedWith = expanded;
          break;
        }
      }
    }
  }

  // Fix (2026-08-06, FIX 4) — the ORIGINAL (and any expanded) query found
  // literally NOTHING (not "found a weak match" — that's the separate,
  // already-existing relevance-threshold path below) across every enabled
  // provider. Only THIS case triggers token-broadening: a specific query
  // that already found something is never second-guessed, so an already-
  // working query never pays the extra round-trip cost.
  if (!picked) {
    const broadenedCandidates = buildBroadenedQueries(query).slice(1);
    for (const broader of broadenedCandidates) {
      picked = await searchAndPick(broader);
      if (picked) {
        searchedWith = broader;
        logger.info({ originalQuery: query, widenedQuery: broader }, "[ai broll resolver] original query found nothing — a broadened phrasing found a usable match");
        break;
      }
    }
  }

  if (!picked) {
    const wasBroadened = buildBroadenedQueries(query).length > 1 || (item.searchQueries?.length ?? 0) > 0;
    // Rule 9 (2026-08-08) — every rejected query, logged with what was
    // actually tried, so a real production gap like the one this fix was
    // traced from ("Aapke Ghar Tak" -> zero usable stock results) is
    // observable going forward instead of only visible after the fact via
    // resolutionNote on the persisted plan.
    logger.warn({ query, alternativesTried: item.searchQueries ?? [], wasBroadened }, "[ai broll resolver] no stock results found for any candidate query — b-roll slot will be unresolved");
    return {
      ...item,
      resolutionNote: `No stock results found for "${query}"${wasBroadened ? ", even after trying related queries and broader phrasings" : ""}.`,
    };
  }
  if (minRelevanceScore != null && picked.relevanceScore < minRelevanceScore) {
    // Rule 9 — same observability for the "found something, but too weak
    // to trust" rejection path (this is the exact path the real production
    // "Aapke Ghar Tak" b-roll loss went through: a 0.33-relevance match
    // rejected below the 0.5 threshold).
    logger.warn(
      { query: searchedWith, bestTitle: picked.result.title, relevanceScore: picked.relevanceScore, threshold: minRelevanceScore },
      "[ai broll resolver] best stock match scored below the relevance confidence threshold — rejecting rather than using a poor match"
    );
    return {
      ...item,
      resolutionNote: `Best stock match ("${picked.result.title}") scored ${picked.relevanceScore.toFixed(2)} relevance for "${searchedWith}", below the ${minRelevanceScore} confidence threshold.`,
    };
  }

  // Claim this candidate BEFORE the async materialize call below — see
  // pickBestStockResult's own doc comment on `excludeExternalIds` for why
  // externalId (not resolvedAssetId) is the stable dedup key, and this
  // file's own header comment on resolveBrollItems for the "synchronous
  // claim, still-parallel resolution" reasoning.
  usedExternalIds?.add(`${picked.providerId}:${picked.result.externalId}`);

  const materialized = await materializeStockAsset(ctx.userId, picked.providerId, "STOCK_MEDIA", picked.result);
  return { ...item, resolvedAssetId: materialized.id, resolvedAssetUrl: materialized.thumbnailUrl ?? materialized.url, costUsd: 0 };
}

// Downloads/decodes a freshly-generated image or video's output (a
// `data:` URI for most adapters here — Gemini Images/Veo's own
// convention — or a plain https URL for others, e.g. OpenAI Images) and
// persists it as a real EditorAsset, the SAME shape materializeStockAsset
// produces for a stock result — no existing helper does this for
// GENERATED (as opposed to stock) output, so this is new, but it's a
// deliberate mirror of that function's own upload+create+best-effort-
// thumbnail structure, not a divergent one.
export async function persistGeneratedMediaAsset(
  userId: string,
  kind: "IMAGE" | "VIDEO",
  mediaUrl: string,
  durationSeconds?: number
): Promise<{ id: string; url: string; thumbnailUrl: string | null }> {
  let buffer: Buffer;
  let contentType: string;
  if (mediaUrl.startsWith("data:")) {
    const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(mediaUrl);
    if (!match) throw new Error("Generated media returned an unparseable data URI.");
    contentType = match[1];
    buffer = Buffer.from(match[2], "base64");
  } else {
    const res = await fetch(mediaUrl, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`Failed to download generated media (${res.status}).`);
    buffer = Buffer.from(await res.arrayBuffer());
    contentType = res.headers.get("content-type") ?? (kind === "IMAGE" ? "image/png" : "video/mp4");
  }

  const storage = await getStorageProvider();
  const key = `ai-broll/${kind.toLowerCase()}/${userId}/${randomUUID()}`;
  await storage.upload({ key, data: buffer, contentType });

  const asset = await prisma.editorAsset.create({
    data: {
      userId,
      scope: "USER",
      kind,
      status: "READY",
      storageKey: key,
      originalFilename: `AI-generated ${kind.toLowerCase()} b-roll`,
      mimeType: contentType,
      fileSizeBytes: buffer.byteLength,
      // Same defensive coercion as search-service.ts's materializeStockAsset
      // (2026-07-21) — a real incident traced to a stock adapter passing a
      // numeric-looking string here, which Prisma rejects with no
      // compile-time warning. Cheap to apply here too rather than trust
      // every current and future generation provider adapter to always
      // return a real number.
      durationSeconds: durationSeconds != null ? Number(durationSeconds) : null,
    },
  });

  try {
    const thumb = kind === "IMAGE" ? await generateImageThumbnail(buffer) : await generateVideoThumbnail(buffer);
    const thumbKey = `${key}.thumb.jpg`;
    await storage.upload({ key: thumbKey, data: thumb, contentType: "image/jpeg" });
    await prisma.editorAsset.update({ where: { id: asset.id }, data: { thumbnailKey: thumbKey } });
  } catch (err) {
    logger.error({ err, assetId: asset.id }, "[ai broll resolver] thumbnail generation failed for a generated asset");
  }

  const finalRow = await prisma.editorAsset.findUniqueOrThrow({ where: { id: asset.id } });
  return {
    id: finalRow.id,
    url: storage.getPublicUrl(finalRow.storageKey),
    thumbnailUrl: finalRow.thumbnailKey ? storage.getPublicUrl(finalRow.thumbnailKey) : null,
  };
}

async function resolveGeneratedBroll(item: AIBroll, ctx: BrollResolutionContext): Promise<AIBroll> {
  const generation = item.generation;
  if (!generation) return { ...item, resolutionNote: 'source:"generate" but no generation block was provided.' };

  // Fixed (2026-07-24) — neither branch below checked for a mock-fallback
  // result; resolveBrollItem()'s own outer try/catch already converts any
  // thrown error here into a graceful "couldn't resolve this item"
  // resolutionNote (no resolvedAssetId) rather than failing the whole AI
  // Auto-Edit apply — the same per-item degradation this resolver already
  // uses for a stock search that finds nothing, so throwing here is the
  // right fit, not a new failure mode.
  if (generation.kind === "image") {
    const result = await generateImage({ prompt: generation.prompt, aspectRatio: ctx.aspectRatio }, "ai_broll_image", { userId: ctx.userId });
    if (result.providerId === MOCK_PROVIDER_ID) {
      throw new Error("B-roll image generation used the placeholder provider, not a real one.");
    }
    const asset = await persistGeneratedMediaAsset(ctx.userId, "IMAGE", result.imageUrl);
    return { ...item, resolvedAssetId: asset.id, resolvedAssetUrl: asset.thumbnailUrl ?? asset.url, costUsd: result.costUsd ?? 0 };
  }

  const durationSeconds = Math.max(1, Math.round((item.endMs - item.startMs) / 1000));
  const result = await renderVideo(
    { script: generation.prompt, aspectRatio: ctx.aspectRatio, durationSeconds, quality: "720p" },
    "ai_broll_video",
    { userId: ctx.userId }
  );
  if (result.providerId === MOCK_PROVIDER_ID) {
    throw new Error("B-roll video generation used the placeholder provider, not a real one.");
  }
  const asset = await persistGeneratedMediaAsset(ctx.userId, "VIDEO", result.videoUrl, result.durationSeconds);
  return { ...item, resolvedAssetId: asset.id, resolvedAssetUrl: asset.thumbnailUrl ?? asset.url, costUsd: result.costUsd ?? 0 };
}

export async function resolveBrollItem(item: AIBroll, ctx: BrollResolutionContext, usedExternalIds?: Set<string>): Promise<AIBroll> {
  try {
    if (!ctx.stockOnly) {
      return item.source === "stock" ? await resolveStockBroll(item, ctx, undefined, undefined, usedExternalIds) : await resolveGeneratedBroll(item, ctx);
    }
    // Founder policy (2026-07-18) — hard backstop, independent of
    // item.source: always try stock first, using item.searchQuery if
    // present, otherwise falling back to the generation prompt's own text
    // as a literal search phrase (covers a model that didn't comply with
    // the prompt's stock-only instruction and still proposed "generate").
    // Generation only fires if that stock attempt found literally nothing.
    const stockResult = await resolveStockBroll(item, ctx, item.searchQuery ?? item.generation?.prompt, ctx.relevanceFallbackThreshold, usedExternalIds);
    if (stockResult.resolvedAssetId) return stockResult;
    if (!item.generation) {
      return { ...stockResult, resolutionNote: `${stockResult.resolutionNote ?? "No stock results found."} (stock-only policy active — no generation prompt was available to fall back to.)` };
    }
    logger.warn({ item, resolutionNote: stockResult.resolutionNote }, "[ai broll resolver] stock-only policy: no usable stock match (missing or below relevance threshold), falling back to generation as a last resort");
    const generated = await resolveGeneratedBroll(item, ctx);
    return generated.resolvedAssetId
      ? { ...generated, resolutionNote: "Stock-only policy active, but no stock provider had a usable match — fell back to generation as a last resort." }
      : generated;
  } catch (err) {
    const message = err instanceof Error ? err.message : "B-roll resolution failed.";
    logger.error({ err, item }, "[ai broll resolver] resolution failed");
    return { ...item, resolutionNote: message };
  }
}

// Runs every item's resolution independently and in parallel — one slow
// or failing item never blocks/breaks another (each is already its own
// try/catch inside resolveBrollItem, so Promise.all here can never
// reject). `usedExternalIds` (2026-08-07) — ONE shared Set across every
// item in this job, so "never reuse the exact same stock clip multiple
// times" holds across the WHOLE video, not just within one slot's own
// query-expansion/broadening attempts. Real-time-safe under parallel
// resolution because each item claims its own pick (adds to the set)
// SYNCHRONOUSLY, before its own async materialize call — see
// resolveStockBroll's own doc comment.
export async function resolveBrollItems(items: AIBroll[], ctx: BrollResolutionContext): Promise<AIBroll[]> {
  const usedExternalIds = new Set<string>();
  return Promise.all(items.map((item) => resolveBrollItem(item, ctx, usedExternalIds)));
}
