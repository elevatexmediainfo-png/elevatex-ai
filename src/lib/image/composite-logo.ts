import sharp from "sharp";

export type LogoPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "bottom-center";

export interface LogoPlacementOptions {
  position: LogoPosition;
  /** Logo width as a percentage of canvas width (5-25), aspect ratio always preserved. */
  scalePercent: number;
  /** Safe-margin distance from the canvas edge, as a percentage of canvas width/height. */
  marginPercent: number;
}

export interface LogoPlacement {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Pure math, deliberately separated from the sharp I/O below so it's
// unit-testable without real image bytes. Always preserves the logo's own
// aspect ratio (scales by width only, via sharp's `fit: "inside"` at the
// call site) — section 3's "do not stretch it" requirement.
export function calculateLogoPlacement(
  canvasWidth: number,
  canvasHeight: number,
  logoNaturalWidth: number,
  logoNaturalHeight: number,
  opts: LogoPlacementOptions
): LogoPlacement {
  const width = Math.round((canvasWidth * opts.scalePercent) / 100);
  const height = Math.round(width * (logoNaturalHeight / logoNaturalWidth));

  const marginX = Math.round((canvasWidth * opts.marginPercent) / 100);
  const marginY = Math.round((canvasHeight * opts.marginPercent) / 100);

  let top: number;
  let left: number;

  switch (opts.position) {
    case "top-left":
      top = marginY;
      left = marginX;
      break;
    case "top-right":
      top = marginY;
      left = canvasWidth - width - marginX;
      break;
    case "bottom-left":
      top = canvasHeight - height - marginY;
      left = marginX;
      break;
    case "bottom-center":
      top = canvasHeight - height - marginY;
      left = Math.round((canvasWidth - width) / 2);
      break;
    case "bottom-right":
    default:
      top = canvasHeight - height - marginY;
      left = canvasWidth - width - marginX;
      break;
  }

  return { top: Math.max(0, top), left: Math.max(0, left), width, height };
}

// Composites a logo onto a base image at a calculated safe-margin position,
// scaled proportionally (never stretched — `fit: "inside"` preserves the
// logo's own aspect ratio while resizing only by target width).
export async function compositeLogo(
  baseBuffer: Buffer,
  logoBuffer: Buffer,
  opts: LogoPlacementOptions
): Promise<Buffer> {
  const baseMeta = await sharp(baseBuffer).metadata();
  const logoMeta = await sharp(logoBuffer).metadata();
  if (!baseMeta.width || !baseMeta.height || !logoMeta.width || !logoMeta.height) {
    throw new Error("Could not read image dimensions for logo compositing.");
  }

  const placement = calculateLogoPlacement(baseMeta.width, baseMeta.height, logoMeta.width, logoMeta.height, opts);

  const resizedLogo = await sharp(logoBuffer)
    .resize(placement.width, placement.height, { fit: "inside" })
    .toBuffer();

  return sharp(baseBuffer)
    .composite([{ input: resizedLogo, top: placement.top, left: placement.left }])
    .jpeg({ quality: 92 })
    .toBuffer();
}
