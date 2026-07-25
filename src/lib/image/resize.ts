import sharp from "sharp";

// Milestone 15 — gpt-image-1 (and every other configured image provider)
// only ever returns one of a few fixed sizes; the rich platform-preset
// catalog (Instagram Portrait 1080x1350, Facebook Cover, etc.) needs exact
// pixel dimensions the provider can't natively produce. `fit: "cover"` with
// `position: "attention"` smart-crops to the target box with zero
// distortion (sharp's libvips saliency heuristic picks the crop region,
// rather than a naive center-crop that could cut off a subject).
export async function resizeToTarget(buffer: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(buffer)
    .resize(width, height, { fit: "cover", position: "attention" })
    .jpeg({ quality: 92 })
    .toBuffer();
}

// Every generated creative is persisted under a hardcoded `.jpg` storage key
// (lib/creative/engine.ts) and served with `Content-Type: image/jpeg` — a
// promise that must hold regardless of what format the source image
// actually was. resizeToTarget() already guarantees this for presets with
// fixed pixel dimensions (it always re-encodes via sharp's .jpeg()), and
// compositeLogo() does the same when a logo is present. This is the missing
// third case: a preset with NO target dimensions and NO logo previously
// uploaded the provider's raw bytes completely unconverted — harmless for a
// real provider that happens to return JPEG, but broken for anything else
// (e.g. the Mock Image Provider's placehold.co URLs, which serve SVG by
// default with no file extension in the URL — those SVG bytes were getting
// served under a `.jpg` key claiming `image/jpeg`, which no browser can
// decode, producing a broken-image icon). sharp auto-detects the real input
// format from the bytes themselves (not a declared extension), so this
// rasterizes SVG/PNG/whatever-the-provider-returned into a genuine JPEG.
export async function normalizeToJpeg(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).jpeg({ quality: 92 }).toBuffer();
}
