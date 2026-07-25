import { describe, expect, it } from "vitest";

import { resolveToolHref } from "./tool-routing";

describe("resolveToolHref", () => {
  it("uses routeOverride when set, regardless of pipeline", () => {
    const href = resolveToolHref({ pipeline: "VIDEO", routeOverride: "/create?objective=PROMOTION", presetKey: null });
    expect(href).toBe("/create?objective=PROMOTION");
  });

  it("falls back to the pipeline's default route when no override is set", () => {
    expect(resolveToolHref({ pipeline: "VIDEO", routeOverride: null, presetKey: null })).toBe("/create");
    expect(resolveToolHref({ pipeline: "IMAGE", routeOverride: null, presetKey: null })).toBe("/create/image");
    expect(resolveToolHref({ pipeline: "SOCIAL_MEDIA", routeOverride: null, presetKey: null })).toBe("/create/social");
    expect(resolveToolHref({ pipeline: "MARKETING_CREATIVE", routeOverride: null, presetKey: null })).toBe("/create/marketing");
    expect(resolveToolHref({ pipeline: "TALKING_HEAD", routeOverride: null, presetKey: null })).toBe("/create/talking-head");
    expect(resolveToolHref({ pipeline: "BRAND_ASSET", routeOverride: null, presetKey: null })).toBe("/brand-kit");
  });

  it("appends a preset query param for the image-output pipelines when no override is set", () => {
    expect(resolveToolHref({ pipeline: "IMAGE", routeOverride: null, presetKey: "youtube_thumbnail" })).toBe(
      "/create/image?preset=youtube_thumbnail"
    );
    expect(resolveToolHref({ pipeline: "SOCIAL_MEDIA", routeOverride: null, presetKey: "instagram_post" })).toBe(
      "/create/social?preset=instagram_post"
    );
  });

  it("does not append a preset query param for pipelines that don't take one", () => {
    expect(resolveToolHref({ pipeline: "VIDEO", routeOverride: null, presetKey: "something" })).toBe("/create");
    expect(resolveToolHref({ pipeline: "TALKING_HEAD", routeOverride: null, presetKey: "something" })).toBe("/create/talking-head");
  });

  it("falls back to /create for an unrecognized pipeline", () => {
    expect(resolveToolHref({ pipeline: "SOMETHING_NEW", routeOverride: null, presetKey: null })).toBe("/create");
  });
});
