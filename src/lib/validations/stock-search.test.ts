import { describe, expect, it } from "vitest";
import { materializeStockAssetSchema } from "./stock-search";

// Stock providers expansion (2026-07-18) — regression test for a real bug
// caught before it shipped: z.object()'s default strip behavior silently
// dropped `attributionRequired` at this exact API boundary (the field
// wasn't in the schema at all) even though the client sent it — a real
// license/attribution requirement would have vanished between the search
// response and the persisted EditorAsset with no error anywhere.
describe("materializeStockAssetSchema", () => {
  it("keeps attribution AND attributionRequired through validation, not just attribution", () => {
    const parsed = materializeStockAssetSchema.parse({
      providerId: "openverse",
      category: "STOCK_MEDIA",
      result: {
        externalId: "abc",
        title: "A photo",
        previewUrl: "https://x/preview.jpg",
        downloadUrl: "https://x/full.jpg",
        kind: "IMAGE",
        attribution: '"A photo" by someone is licensed under CC BY-SA 2.0.',
        attributionRequired: true,
      },
    });

    expect(parsed.result.attribution).toBe('"A photo" by someone is licensed under CC BY-SA 2.0.');
    expect(parsed.result.attributionRequired).toBe(true);
  });

  it("accepts a result with no attribution fields at all (Pexels/Pixabay's own case)", () => {
    const parsed = materializeStockAssetSchema.parse({
      providerId: "pexels",
      category: "STOCK_MEDIA",
      result: { externalId: "1", title: "A photo", previewUrl: "https://x/p.jpg", downloadUrl: "https://x/d.jpg", kind: "IMAGE" },
    });

    expect(parsed.result.attribution).toBeUndefined();
    expect(parsed.result.attributionRequired).toBeUndefined();
  });
});
