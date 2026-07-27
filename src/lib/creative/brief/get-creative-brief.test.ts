import { beforeEach, describe, expect, it, vi } from "vitest";

const videoProjectFindUniqueMock = vi.fn();
const profileFindUniqueMock = vi.fn();
const brandKitFindUniqueMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    videoProject: { findUnique: (...args: unknown[]) => videoProjectFindUniqueMock(...args) },
    profile: { findUnique: (...args: unknown[]) => profileFindUniqueMock(...args) },
    brandKit: { findUnique: (...args: unknown[]) => brandKitFindUniqueMock(...args) },
  },
}));

const { getCreativeBrief, CreativeBriefError } = await import("./get-creative-brief");

const baseProfile = { businessName: "Glow Candles", businessVertical: "RETAIL", city: "Mumbai" };
const baseBrandKit = {
  primaryColor: "#FFAA00",
  secondaryColor: null,
  fontFamily: null,
  guidelinesText: null,
  contactPhone: null,
  contactWhatsapp: null,
  addressLine: null,
  websiteOrSocial: null,
};

describe("getCreativeBrief", () => {
  beforeEach(() => {
    videoProjectFindUniqueMock.mockReset();
    profileFindUniqueMock.mockReset();
    brandKitFindUniqueMock.mockReset();
    profileFindUniqueMock.mockResolvedValue(baseProfile);
    brandKitFindUniqueMock.mockResolvedValue(baseBrandKit);
  });

  it("throws when the VideoProject doesn't exist", async () => {
    videoProjectFindUniqueMock.mockResolvedValue(null);
    await expect(getCreativeBrief("missing")).rejects.toThrow(CreativeBriefError);
  });

  it("throws for a TALKING_HEAD_UPLOAD project instead of fabricating a brief", async () => {
    videoProjectFindUniqueMock.mockResolvedValue({
      id: "proj_1",
      userId: "user_1",
      sourceType: "TALKING_HEAD_UPLOAD",
      contentLanguage: "EN",
      objective: "PROMOTION",
      brief: null,
    });
    await expect(getCreativeBrief("proj_1")).rejects.toThrow(CreativeBriefError);
  });

  it("throws for a GENERATED project with no brief recorded", async () => {
    videoProjectFindUniqueMock.mockResolvedValue({
      id: "proj_1",
      userId: "user_1",
      sourceType: "GENERATED",
      contentLanguage: "EN",
      objective: "PROMOTION",
      brief: null,
    });
    await expect(getCreativeBrief("proj_1")).rejects.toThrow(CreativeBriefError);
  });

  it("builds a commercial Creative Brief for a GENERATED project", async () => {
    videoProjectFindUniqueMock.mockResolvedValue({
      id: "proj_1",
      userId: "user_1",
      sourceType: "GENERATED",
      contentLanguage: "EN",
      objective: "PROMOTION",
      brief: {
        productOrService: "Handmade candles",
        keyMessage: "Light up your evenings",
        offerDetails: "20% off",
        callToAction: "Order now",
        tone: "FRIENDLY",
      },
    });

    const brief = await getCreativeBrief("proj_1");

    expect(brief.videoProjectId).toBe("proj_1");
    expect(brief.brand.businessName).toBe("Glow Candles");
    expect(brief.content).toEqual({
      style: "commercial",
      objective: "PROMOTION",
      productOrService: "Handmade candles",
      keyMessage: "Light up your evenings",
      offerDetails: "20% off",
      callToAction: "Order now",
      tone: "FRIENDLY",
    });
  });

  it("builds a film Creative Brief for a FILM project", async () => {
    videoProjectFindUniqueMock.mockResolvedValue({
      id: "proj_2",
      userId: "user_1",
      sourceType: "FILM",
      contentLanguage: "HINGLISH",
      objective: "BRAND_AWARENESS",
      brief: {
        idea: "A chai seller's morning routine turns into a heartwarming ad.",
        style: "CINEMATIC",
        totalDurationSeconds: 20,
        characterCount: 2,
      },
    });

    const brief = await getCreativeBrief("proj_2");

    expect(brief.content).toEqual({
      style: "film",
      idea: "A chai seller's morning routine turns into a heartwarming ad.",
      filmStyle: "CINEMATIC",
      totalDurationSeconds: 20,
      characterCount: 2,
    });
  });

  it("rejects a malformed GENERATED brief instead of silently passing bad data through", async () => {
    videoProjectFindUniqueMock.mockResolvedValue({
      id: "proj_1",
      userId: "user_1",
      sourceType: "GENERATED",
      contentLanguage: "EN",
      objective: "PROMOTION",
      brief: { productOrService: "" },
    });

    await expect(getCreativeBrief("proj_1")).rejects.toThrow();
  });
});
