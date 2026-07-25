import type { ProviderCategory } from "@/generated/prisma/client";
import type { ProviderRuntimeConfig } from "../credentials";
import { PexelsAdapter } from "./pexels.adapter";
import { PixabayAdapter } from "./pixabay.adapter";
import { IconScoutAdapter } from "./iconscout.adapter";
import { CoverrAdapter } from "./coverr.adapter";
import { UnsplashAdapter } from "./unsplash.adapter";
import { OpenverseAdapter } from "./openverse.adapter";
import type { StockProviderAdapter } from "./types";

// Milestone 26/27 — mirrors the resolution style of every generation-
// provider registry in this codebase (one id -> concrete adapter class
// lookup). icons8 and lottiefiles intentionally return null: their
// PROVIDER_CATALOGUE/ProviderConfig credential slots already exist (see
// lib/admin/ai-providers.ts) so an admin can save keys today, but no
// working adapter is wired yet — exactly the "credential slot ready,
// adapter not yet built" state the Admin Settings spec asked for.
// lottiefiles specifically: a real adapter class exists
// (lottiefiles.adapter.ts) but is deliberately NOT wired in here — its
// target endpoint (api.lottiefiles.com) does not resolve (confirmed via a
// live DNS lookup, not assumed), and a real web search turned up no
// confirmed public REST search API to replace it with. icons8 is a
// deliberate scope decision (Milestone 27): its attribution requirement
// makes it a lower priority than IconScout, revisited only if IconScout's
// free-tier quota proves limiting. Wiring either in later is
// adding/uncommenting a case here, no schema change.
export function getStockAdapter(
  category: ProviderCategory,
  providerId: string,
  config: ProviderRuntimeConfig
): StockProviderAdapter | null {
  if (category === "STOCK_MEDIA") {
    switch (providerId) {
      case "pexels":
        return new PexelsAdapter(config);
      case "pixabay":
        return new PixabayAdapter(config);
      // Stock providers expansion (2026-07-18) — Coverr (video+music,
      // requires attribution — see coverr.adapter.ts), Unsplash (images,
      // requires attribution per its API Terms — see unsplash.adapter.ts's
      // own doc comment), Openverse (images+audio, no credentials needed,
      // per-item attribution driven by each result's own license).
      case "coverr":
        return new CoverrAdapter(config);
      case "unsplash":
        return new UnsplashAdapter(config);
      case "openverse":
        return new OpenverseAdapter(config);
      default:
        // lottiefiles falls here too — see header comment.
        return null;
    }
  }
  if (category === "ICON") {
    switch (providerId) {
      case "iconscout":
        return new IconScoutAdapter(config);
      default:
        // icons8 falls here too — see header comment.
        return null;
    }
  }
  return null;
}
