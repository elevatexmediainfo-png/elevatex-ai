// Timeline clip filmstrip (2026-07-13) — pure constants + math shared by
// BOTH the server-side generator (thumbnails.ts, which composites a real
// sprite sheet) and the client-side canvas renderer (ClipBlock,
// timeline-panel.tsx) so neither side has to guess the other's layout.
// Deliberately has zero fs/ffmpeg/DB imports, same "pure logic lives in its
// own file" split timeline-engine.ts already established for this reason —
// this file is safe to import from a client component.

// Each frame tile in the generated sprite sheet is a fixed size, cropped
// (not letterboxed) to fill it regardless of the source video's own aspect
// ratio — the same "small, uniform preview tile" look every mainstream NLE
// filmstrip uses. Fixed size means the client never needs to store/fetch
// per-tile dimensions: tileWidth = spriteImage.naturalWidth / frameCount
// always holds.
export const FILMSTRIP_TILE_WIDTH = 80;
export const FILMSTRIP_TILE_HEIGHT = 80;

// How many frames to extract per asset — a fixed pool generated ONCE and
// cached (EditorAsset.filmstripKey/filmstripFrameCount), not recomputed per
// render or per zoom level. Denser for longer source videos (more of the
// timeline to cover) but bounded on both ends: a 5s clip still gets a
// minimum-viable strip, a 30-minute clip doesn't generate hundreds of tiny
// ffmpeg-decoded frames for one asset. Zoom-responsive rendering (how many
// of these cached frames actually get drawn at a given clip width) is a
// client-side rendering concern, not an extraction-time one.
export const FILMSTRIP_MIN_FRAMES = 8;
export const FILMSTRIP_MAX_FRAMES = 40;
const FILMSTRIP_SECONDS_PER_FRAME = 2;

export function computeFilmstripFrameCount(durationSeconds: number): number {
  const raw = Math.round(durationSeconds / FILMSTRIP_SECONDS_PER_FRAME);
  return Math.min(FILMSTRIP_MAX_FRAMES, Math.max(FILMSTRIP_MIN_FRAMES, raw));
}

// Pure — which of the asset's cached sprite frames fall within a clip's
// visible (trimmed) span, in ascending order. The sprite covers the
// asset's FULL duration; a clip usually only shows a sub-range of it
// (trimStartMs..trimStartMs+durationMs). Each frame i is treated as
// representing source time `i * (assetDurationMs / frameCount)` — an
// approximation (ffmpeg's fps-filter sampling isn't stored per-frame),
// close enough for a preview strip. Always returns at least one index
// (the nearest frame to the clip's midpoint) even if the trim window is
// narrower than one frame's sampling interval, so a heavily-trimmed clip
// still shows *something* rather than an empty strip.
//
// `maxVisibleFrames` (optional) caps how many of the in-range frames are
// actually returned, evenly thinned rather than just truncated from one
// end — the zoom-responsive-density hook (fewer tiles at low zoom, up to
// all cached frames at high zoom) builds on this same function rather
// than a separate one.
export function computeVisibleFilmstripFrameIndices(
  frameCount: number,
  assetDurationMs: number,
  trimStartMs: number,
  durationMs: number,
  maxVisibleFrames?: number
): number[] {
  if (frameCount <= 0 || assetDurationMs <= 0) return [];
  const frameIntervalMs = assetDurationMs / frameCount;
  const trimEndMs = trimStartMs + durationMs;

  const inRange: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    const frameTimeMs = i * frameIntervalMs;
    if (frameTimeMs >= trimStartMs - frameIntervalMs && frameTimeMs <= trimEndMs + frameIntervalMs) {
      inRange.push(i);
    }
  }

  if (inRange.length === 0) {
    const centerMs = trimStartMs + durationMs / 2;
    return [Math.min(frameCount - 1, Math.max(0, Math.round(centerMs / frameIntervalMs)))];
  }

  if (!maxVisibleFrames || inRange.length <= maxVisibleFrames) return inRange;

  // Evenly thin down to maxVisibleFrames — picks indices spread across
  // the in-range list rather than just its first N, so thinning a long
  // strip still samples across its full visible time span.
  const step = (inRange.length - 1) / (maxVisibleFrames - 1);
  const thinned = new Set<number>();
  for (let slot = 0; slot < maxVisibleFrames; slot++) {
    thinned.add(inRange[Math.round(slot * step)]);
  }
  return Array.from(thinned).sort((a, b) => a - b);
}
