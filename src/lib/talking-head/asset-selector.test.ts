import { describe, expect, it } from "vitest";

import { selectAssetForScene, type AssetCandidate, type AssetSelectionInput } from "./asset-selector";

function baseInput(overrides: Partial<AssetSelectionInput> = {}): AssetSelectionInput {
  return {
    visualType: "IMAGE",
    tags: [],
    projectAssets: [],
    brandAssets: [],
    uploadedAssets: [],
    stockAssets: [],
    aiVideoEnabled: false,
    ...overrides,
  };
}

function candidate(overrides: Partial<AssetCandidate>): AssetCandidate {
  return { source: "UPLOAD", mediaKind: "IMAGE", storageKey: "k1", label: "asset", ...overrides };
}

describe("selectAssetForScene", () => {
  it("prefers an existing project asset over everything else", () => {
    const result = selectAssetForScene(
      baseInput({
        tags: ["office"],
        projectAssets: [candidate({ label: "office desk" })],
        stockAssets: [{ source: "STOCK", mediaKind: "IMAGE", url: "https://stock/office.jpg", label: "office" }],
      })
    );
    expect(result.kind).toBe("REUSE_EXISTING");
  });

  it("falls back to Brand Kit when no project asset matches", () => {
    const result = selectAssetForScene(
      baseInput({
        tags: ["logo"],
        brandAssets: [candidate({ label: "logo", source: "BRAND" })],
      })
    );
    expect(result.kind).toBe("REUSE_BRAND");
  });

  it("falls back to uploaded assets when no project/brand match", () => {
    const result = selectAssetForScene(
      baseInput({
        tags: ["warehouse"],
        uploadedAssets: [candidate({ label: "warehouse photo" })],
      })
    );
    expect(result.kind).toBe("REUSE_UPLOADED");
  });

  it("falls back to the stock library when nothing reusable matches", () => {
    const result = selectAssetForScene(
      baseInput({
        tags: ["growth"],
        stockAssets: [{ source: "STOCK", mediaKind: "IMAGE", url: "https://stock/growth.jpg", label: "growth chart" }],
      })
    );
    expect(result.kind).toBe("STOCK");
  });

  it("falls back to AI_IMAGE when nothing matches and the visual type wants an image", () => {
    const result = selectAssetForScene(baseInput({ visualType: "IMAGE", tags: ["something obscure"] }));
    expect(result.kind).toBe("AI_IMAGE");
    expect(result.mediaKind).toBe("IMAGE");
  });

  it("falls back to AI_VIDEO for B_ROLL when the premium flag is enabled", () => {
    const result = selectAssetForScene(baseInput({ visualType: "B_ROLL", aiVideoEnabled: true }));
    expect(result.kind).toBe("AI_VIDEO");
  });

  it("downgrades to AI_IMAGE for B_ROLL when the premium flag is disabled", () => {
    const result = selectAssetForScene(baseInput({ visualType: "B_ROLL", aiVideoEnabled: false }));
    expect(result.kind).toBe("AI_IMAGE");
    expect(result.mediaKind).toBe("IMAGE");
  });

  it("only considers the Brand Kit logo for LOGO scenes, never tag-matched project/stock assets", () => {
    const result = selectAssetForScene(
      baseInput({
        visualType: "LOGO",
        projectAssets: [candidate({ label: "logo placeholder" })],
        stockAssets: [{ source: "STOCK", mediaKind: "IMAGE", url: "https://stock/logo.jpg", label: "logo" }],
      })
    );
    expect(result.kind).toBe("AI_IMAGE");
  });

  it("reuses the Brand Kit logo for LOGO scenes when one is configured", () => {
    const result = selectAssetForScene(
      baseInput({ visualType: "LOGO", brandAssets: [candidate({ label: "brand logo", source: "BRAND" })] })
    );
    expect(result.kind).toBe("REUSE_BRAND");
  });

  it("does not match a candidate of the wrong media kind", () => {
    const result = selectAssetForScene(
      baseInput({
        visualType: "B_ROLL",
        tags: ["office"],
        projectAssets: [candidate({ label: "office", mediaKind: "IMAGE" })],
        aiVideoEnabled: true,
      })
    );
    expect(result.kind).toBe("AI_VIDEO");
  });
});
