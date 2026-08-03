import type { ImageGenerateRequest, ImageGenerateResult, ImageProvider } from "./types";

const DIMENSIONS_BY_RATIO: Record<ImageGenerateRequest["aspectRatio"], string> = {
  RATIO_1_1: "640x640",
  RATIO_4_5: "640x800",
  RATIO_3_4: "640x853",
  RATIO_2_3: "640x960",
  RATIO_9_16: "640x1138",
  RATIO_16_9: "640x360",
  RATIO_3_2: "640x427",
  RATIO_4_3: "640x480",
};

// Default provider (selected when PROVIDER_IMAGE_PRIORITY has no other entry
// available) — returns a deterministic
// placeholder image so thumbnails render without API credentials.
export class MockImageProvider implements ImageProvider {
  readonly id = "mock";
  readonly category = "IMAGE" as const;

  async generate(req: ImageGenerateRequest): Promise<ImageGenerateResult> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const seed = encodeURIComponent(req.prompt.slice(0, 24) || "Elevatex AI");
    const dimensions = DIMENSIONS_BY_RATIO[req.aspectRatio];

    return {
      imageUrl: `https://placehold.co/${dimensions}/1a3c6e/white?text=${seed}`,
      providerRef: `mock-image-${Date.now()}`,
    };
  }
}
