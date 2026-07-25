// Post-generation image quality analysis using sharp.
// No LLM call, no external API, no additional credit cost.
// Runs on the final image buffer after generation completes.
//
// Metrics computed:
//   - Average perceived brightness (CIE luminance weighting)
//   - Standard deviation of brightness (proxy for visual entropy / detail)
// From these, we detect the most common generation failures:
//   - Near-blank / nearly-uniform images (model failed to render subject)
//   - Severely underexposed output (very dark scenes)
//   - Overexposed / blown-out output
//   - Low-contrast / low-detail output

import sharp from "sharp";

export interface QualityResult {
  score: number; // 0–100; below 50 triggers shouldSuggestRetry
  issues: string[];
  recommendations: string[];
  shouldSuggestRetry: boolean;
  metrics: {
    avgBrightness: number; // 0–1
    brightnessStdDev: number; // 0–1; low = uniform / blank
  };
}

const SAMPLE_SIZE = 256; // px — resize before pixel analysis for speed

export async function evaluateImageQuality(buffer: Buffer): Promise<QualityResult | null> {
  try {
    const { data, info } = await sharp(buffer)
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "inside", withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels as number;
    const pixelCount = info.width * info.height;

    // Pass 1 — average brightness (CIE luminance approximation)
    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += channels) {
      const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
      totalBrightness += lum;
    }
    const avgBrightness = totalBrightness / pixelCount;

    // Pass 2 — standard deviation of brightness (entropy proxy)
    let totalVariance = 0;
    for (let i = 0; i < data.length; i += channels) {
      const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
      totalVariance += Math.pow(lum - avgBrightness, 2);
    }
    const brightnessStdDev = Math.sqrt(totalVariance / pixelCount);

    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Blank or nearly-uniform image (generation failure, solid-colour output)
    if (brightnessStdDev < 0.03) {
      score -= 65;
      issues.push("Image appears blank or nearly uniform — the model may not have rendered the subject.");
      recommendations.push("Try regenerating. If this repeats, add more descriptive subject detail to your prompt.");
    }

    // Severely underexposed
    if (avgBrightness < 0.07) {
      score -= 35;
      issues.push("Image is very dark or underexposed.");
      recommendations.push("Add lighting guidance: 'bright studio lighting' or 'well-lit, natural daylight'.");
    }

    // Overexposed / blown out
    if (avgBrightness > 0.93) {
      score -= 25;
      issues.push("Image is overexposed or washed out.");
      recommendations.push("Try 'dramatic lighting with rich shadows' to introduce tonal depth.");
    }

    // Low contrast / low detail (but not blank)
    if (brightnessStdDev >= 0.03 && brightnessStdDev < 0.07) {
      score -= 20;
      issues.push("Low visual contrast detected — image may lack detail or definition.");
      recommendations.push("Enhance your prompt with texture, material, and lighting specifics.");
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
      score,
      issues,
      recommendations,
      shouldSuggestRetry: score < 50,
      metrics: { avgBrightness: +avgBrightness.toFixed(3), brightnessStdDev: +brightnessStdDev.toFixed(3) },
    };
  } catch {
    // Any sharp error (unsupported format, OOM, etc.) — degrade gracefully.
    return null;
  }
}
