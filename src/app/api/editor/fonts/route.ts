import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { getConfig } from "@/lib/admin/config";
import { apiError, apiSuccess } from "@/lib/api-response";

// GET /api/editor/fonts — the Text Editor's font picker (Module 7). Real
// dynamic Google Fonts listing when GOOGLE_FONTS_API_KEY is set, otherwise
// gracefully falls back to the existing admin-curated AVAILABLE_FONTS list
// (lib/admin/config.ts) — the same "no key configured -> mock/fallback
// provider" pattern lib/providers/ already establishes for AI providers,
// applied here without needing that whole ProviderConfig/credentials.ts
// machinery, since this is a single, non-AI, read-only external API (a
// plain env var is enough — see the credentials.ts doc comment's own
// LEGACY_ENV_FALLBACK precedent for "env var when no DB-backed config
// exists yet").
//
// The Google Fonts /webfonts/v1 listing changes rarely, so the fetched
// result is cached in-memory for the life of the server process (module-
// level variable) rather than re-fetched on every picker open — ~1,500
// fonts is a non-trivial payload to pull from Google on every request.

export interface EditorFontOption {
  id: string;
  label: string;
  family: string;
  category?: string;
}

let googleFontsCache: { fetchedAt: number; fonts: EditorFontOption[] } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — a font catalog doesn't change intra-day.

async function fetchGoogleFonts(apiKey: string): Promise<EditorFontOption[]> {
  const res = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`, {
    // Next.js's fetch cache is per-request-scope in a route handler; the
    // module-level cache above is what actually avoids repeat calls.
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google Fonts API responded ${res.status}`);
  const data = (await res.json()) as { items?: { family: string; category: string }[] };
  return (data.items ?? []).map((item) => ({
    id: item.family.toLowerCase().replace(/\s+/g, "-"),
    label: item.family,
    family: `'${item.family}', ${item.category === "monospace" ? "monospace" : item.category === "serif" ? "serif" : item.category === "display" || item.category === "handwriting" ? "cursive" : "sans-serif"}`,
    category: item.category,
  }));
}

export async function GET(_req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const apiKey = process.env.GOOGLE_FONTS_API_KEY;
  if (!apiKey) {
    const fallback = await getConfig("AVAILABLE_FONTS");
    return apiSuccess({ fonts: fallback, source: "fallback" as const });
  }

  if (googleFontsCache && Date.now() - googleFontsCache.fetchedAt < CACHE_TTL_MS) {
    return apiSuccess({ fonts: googleFontsCache.fonts, source: "google" as const });
  }

  try {
    const fonts = await fetchGoogleFonts(apiKey);
    googleFontsCache = { fetchedAt: Date.now(), fonts };
    return apiSuccess({ fonts, source: "google" as const });
  } catch (err) {
    console.error("GET /api/editor/fonts — Google Fonts fetch failed, falling back", err);
    const fallback = await getConfig("AVAILABLE_FONTS");
    return apiSuccess({ fonts: fallback, source: "fallback" as const });
  }
}
