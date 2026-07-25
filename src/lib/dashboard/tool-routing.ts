// Milestone 14 — resolves where a CreativeTool card/quick-action launches.
// `routeOverride` always wins (admin-set, exact); otherwise falls back to
// the tool's pipeline so a freshly-added tool with no routeOverride yet
// still lands somewhere sensible instead of a dead link. This is the
// literal "each card must launch its own correct workflow" mapping from
// the brief: AI Video->Video Engine, AI Image->Image Engine, Social
// Media->Creative/Image Engine, Marketing Creative->Creative Engine,
// Talking Head->Talking Head Pipeline, Brand Assets->Brand Asset Engine.
const PIPELINE_DEFAULT_HREF: Record<string, string> = {
  VIDEO: "/create",
  IMAGE: "/create/image",
  SOCIAL_MEDIA: "/create/social",
  MARKETING_CREATIVE: "/create/marketing",
  TALKING_HEAD: "/create/talking-head",
  BRAND_ASSET: "/brand-kit",
  EXTERNAL: "#",
};

export interface RoutableTool {
  pipeline: string;
  routeOverride: string | null;
  presetKey: string | null;
}

export function resolveToolHref(tool: RoutableTool): string {
  if (tool.routeOverride) return tool.routeOverride;

  const base = PIPELINE_DEFAULT_HREF[tool.pipeline] ?? "/create";
  if (tool.presetKey && (tool.pipeline === "IMAGE" || tool.pipeline === "SOCIAL_MEDIA" || tool.pipeline === "MARKETING_CREATIVE")) {
    return `${base}?preset=${encodeURIComponent(tool.presetKey)}`;
  }
  return base;
}
