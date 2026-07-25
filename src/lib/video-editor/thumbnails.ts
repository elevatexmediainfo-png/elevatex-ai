import sharp from "sharp";
import { extractFilmstripFrames, extractThumbnailFrame } from "./ffmpeg-exec";
import { computeFilmstripFrameCount, FILMSTRIP_TILE_HEIGHT, FILMSTRIP_TILE_WIDTH } from "./filmstrip";

// Milestone 26 — Admin Asset Library thumbnail generation. Reuses the
// already-installed `sharp` the same way lib/image/resize.ts's
// resizeToTarget()/normalizeToJpeg() already do, and reuses the ffmpeg
// binary/wrapper (ffmpeg-exec.ts) the same way extractLastFrame() already
// does — no new image/video-processing mechanism, just two thin new
// entry points into the existing ones. ANIMATION/ICON kinds intentionally
// have no thumbnail generator here: a Lottie JSON has no single frame
// without a renderer (out of scope this milestone — the library UI shows a
// type badge instead), and a static icon (SVG/PNG) is already its own tiny
// preview.
const THUMBNAIL_MAX_DIMENSION = 320;

export async function generateImageThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(THUMBNAIL_MAX_DIMENSION, THUMBNAIL_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}

export async function generateVideoThumbnail(videoBuffer: Buffer): Promise<Buffer> {
  const frame = await extractThumbnailFrame(videoBuffer);
  return generateImageThumbnail(frame.buffer);
}

export interface VideoFilmstrip {
  buffer: Buffer;
  frameCount: number;
}

// Fix (2026-07-13) — Timeline clip filmstrip. Extracts computeFilmstripFrameCount()
// frames (see filmstrip.ts for why that count, not a fixed number) in one
// ffmpeg pass, crops each to a uniform FILMSTRIP_TILE_WIDTH x
// FILMSTRIP_TILE_HEIGHT tile (`fit: "cover"` — filled, not letterboxed,
// same convention every mainstream NLE filmstrip uses regardless of the
// source's own aspect ratio), and composites them side by side into ONE
// horizontal JPEG sprite sheet — one storage object, one client fetch,
// trivially sliceable via drawImage's source-rect once frameCount is known
// (tileWidth = spriteWidth / frameCount, a fixed constant both sides
// share, so it never needs to be stored separately).
export async function generateVideoFilmstrip(videoBuffer: Buffer, durationSeconds: number): Promise<VideoFilmstrip> {
  const frameCount = computeFilmstripFrameCount(durationSeconds);
  const rawFrames = await extractFilmstripFrames(videoBuffer, frameCount, durationSeconds);

  const tiles = await Promise.all(
    rawFrames.map((frame) =>
      sharp(frame).resize(FILMSTRIP_TILE_WIDTH, FILMSTRIP_TILE_HEIGHT, { fit: "cover" }).toBuffer()
    )
  );

  const buffer = await sharp({
    create: {
      width: FILMSTRIP_TILE_WIDTH * tiles.length,
      height: FILMSTRIP_TILE_HEIGHT,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(tiles.map((tile, i) => ({ input: tile, left: i * FILMSTRIP_TILE_WIDTH, top: 0 })))
    .jpeg({ quality: 78 })
    .toBuffer();

  return { buffer, frameCount: tiles.length };
}
