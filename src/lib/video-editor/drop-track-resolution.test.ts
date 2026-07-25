import { describe, expect, it } from "vitest";
import { getClipMoveCompatibleTrackKinds, resolveDropTrackKind } from "./drop-track-resolution";

describe("resolveDropTrackKind", () => {
  it("maps a TEXT asset to a TEXT track", () => {
    expect(resolveDropTrackKind({ assetKind: "TEXT", libraryCategory: undefined })).toBe("TEXT");
  });

  it("maps a VIDEO asset to a VIDEO track", () => {
    expect(resolveDropTrackKind({ assetKind: "VIDEO", libraryCategory: undefined })).toBe("VIDEO");
  });

  it("maps an AUDIO asset to an AUDIO track, regardless of Voice/Music/SFX — one track kind, not three", () => {
    expect(resolveDropTrackKind({ assetKind: "AUDIO", libraryCategory: undefined })).toBe("AUDIO");
    expect(resolveDropTrackKind({ assetKind: "AUDIO", libraryCategory: "MUSIC" })).toBe("AUDIO");
    expect(resolveDropTrackKind({ assetKind: "AUDIO", libraryCategory: "SFX" })).toBe("AUDIO");
  });

  it("maps an IMAGE with no library category (Uploads) to VIDEO", () => {
    expect(resolveDropTrackKind({ assetKind: "IMAGE", libraryCategory: undefined })).toBe("VIDEO");
  });

  it("maps an IMAGE from a non-decorative library category (e.g. TEMPLATE) to VIDEO", () => {
    expect(resolveDropTrackKind({ assetKind: "IMAGE", libraryCategory: "TEMPLATE" })).toBe("VIDEO");
  });

  it("maps an IMAGE from each decorative library category to OVERLAY", () => {
    for (const category of ["SHAPE", "STICKER", "LOGO", "STATIC_ICON", "ANIMATED_ICON"]) {
      expect(resolveDropTrackKind({ assetKind: "IMAGE", libraryCategory: category })).toBe("OVERLAY");
    }
  });

  it("returns null for an asset kind with no defined rule (e.g. FONT, ANIMATION), rather than guessing", () => {
    expect(resolveDropTrackKind({ assetKind: "FONT", libraryCategory: undefined })).toBeNull();
    expect(resolveDropTrackKind({ assetKind: "ANIMATION", libraryCategory: undefined })).toBeNull();
    expect(resolveDropTrackKind({ assetKind: undefined, libraryCategory: undefined })).toBeNull();
  });
});

describe("getClipMoveCompatibleTrackKinds", () => {
  it("a VIDEO-backed clip can move to a VIDEO or OVERLAY track (e.g. repositioning as a PIP)", () => {
    expect(getClipMoveCompatibleTrackKinds("VIDEO", "VIDEO")).toEqual(["VIDEO", "OVERLAY"]);
  });

  it("an IMAGE-backed clip can move to a VIDEO or OVERLAY track, regardless of which one it's currently on", () => {
    expect(getClipMoveCompatibleTrackKinds("IMAGE", "OVERLAY")).toEqual(["VIDEO", "OVERLAY"]);
  });

  it("an AUDIO-backed clip can only move to another AUDIO track", () => {
    expect(getClipMoveCompatibleTrackKinds("AUDIO", "AUDIO")).toEqual(["AUDIO"]);
  });

  it("a content-only clip (TEXT/SUBTITLE, no backing asset) is only compatible with its own current track kind", () => {
    expect(getClipMoveCompatibleTrackKinds(null, "TEXT")).toEqual(["TEXT"]);
    expect(getClipMoveCompatibleTrackKinds(null, "SUBTITLE")).toEqual(["SUBTITLE"]);
  });

  it("an asset kind with no defined cross-track rule stays put rather than guessing", () => {
    expect(getClipMoveCompatibleTrackKinds("FONT", "EFFECTS")).toEqual(["EFFECTS"]);
  });
});
