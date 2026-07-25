import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { normalizeToJpeg } from "./resize";

// JPEG's magic bytes (SOI marker) — the only reliable, format-agnostic way
// to assert "this buffer is actually a JPEG" without a full decode.
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

describe("normalizeToJpeg", () => {
  it("rasterizes SVG bytes into a real JPEG — the exact root cause of the broken-image bug (Mock Image Provider's placehold.co URLs serve SVG by default)", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#1a3c6e"/></svg>'
    );
    const result = await normalizeToJpeg(svg);
    expect(result.subarray(0, 3)).toEqual(JPEG_MAGIC);
  });

  it("re-encodes a PNG into a real JPEG", async () => {
    const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#ff0000" } })
      .png()
      .toBuffer();
    const result = await normalizeToJpeg(png);
    expect(result.subarray(0, 3)).toEqual(JPEG_MAGIC);
  });

  it("leaves an already-JPEG buffer decodable as a JPEG of the same dimensions", async () => {
    const jpeg = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#00ff00" } })
      .jpeg()
      .toBuffer();
    const result = await normalizeToJpeg(jpeg);
    const meta = await sharp(result).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(32);
    expect(meta.height).toBe(32);
  });
});
