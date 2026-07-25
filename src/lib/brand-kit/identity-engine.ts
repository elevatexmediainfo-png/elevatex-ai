import { prisma } from "@/lib/prisma";
import { generateImage } from "@/lib/generation/image";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";
import { generateScript } from "@/lib/generation/llm";
import { getStorageProvider } from "@/lib/providers/storage";
import { recordAsset } from "@/lib/assets/service";
import { getCreditBalance, consumeCredits, InsufficientCreditsError } from "@/lib/credits/engine";
import { CreativeToolDisabledError } from "@/lib/creative/engine";
import type {
  GenerateBrandLogoInput,
  GenerateBrandPaletteInput,
  GenerateBrandGuidelinesInput,
} from "@/lib/validations/brand-kit";

// Milestone 14 — Brand Assets generation. No CreativeProject/project model
// here (decision: Brand Assets writes land directly on the existing
// per-user BrandKit row, folded into the existing /brand-kit page) — each
// function below is keyed to one of the `brand_logo`/`brand_palette`/
// `brand_guidelines` CreativeTool rows (seeded disabled-by-default in
// seed-defaults.ts) for its cost/prompt-prefix/preferred provider, same
// admin-configurable source of truth as lib/creative/engine.ts.

async function getTool(key: string) {
  const tool = await prisma.creativeTool.findUnique({ where: { key } });
  if (!tool || !tool.enabled) throw new CreativeToolDisabledError(key);
  return tool;
}

export async function generateBrandLogo(userId: string, input: GenerateBrandLogoInput) {
  const tool = await getTool("brand_logo");
  const amount = tool.creditCostEstimate;
  if (amount > 0) {
    const balance = await getCreditBalance(userId);
    if (balance < amount) throw new InsufficientCreditsError(amount, balance);
  }

  const stylePart = input.style ? `${input.style.toLowerCase()} style` : "clean, modern style";
  const industryPart = input.industry ? ` for a ${input.industry} business` : "";
  const prompt = [
    tool.promptTemplate,
    `A professional logo mark for "${input.businessName}"${industryPart}, ${stylePart}, simple, memorable, on a plain background.`,
  ]
    .filter(Boolean)
    .join(" ");

  const result = await generateImage(
    { prompt, aspectRatio: "RATIO_1_1" },
    "creative_image",
    { userId },
    tool.defaultProviderId ?? undefined
  );

  // Fixed (2026-07-24) — a real IMAGE provider outage would silently save
  // MockImageProvider's canned sample as the user's real business logo,
  // permanently upserted onto their BrandKit row with no indication
  // anything was wrong. Thrown before upload/persist; nothing is written
  // to BrandKit until after this point, so this is a clean no-op failure.
  if (result.providerId === MOCK_PROVIDER_ID) {
    throw new Error("Logo generation used the placeholder provider, not a real one — no IMAGE provider is currently enabled and reachable.");
  }

  const storage = await getStorageProvider();
  const uploaded = await storage.uploadFromUrl({
    key: `brand-kit/${userId}/logo-${Date.now()}.jpg`,
    sourceUrl: result.imageUrl,
    contentType: "image/jpeg",
  });

  return prisma.$transaction(async (tx) => {
    const asset = await recordAsset(
      { userId, kind: "IMAGE", source: "AI_GENERATED", storageKey: uploaded.key, label: `${input.businessName} logo` },
      tx
    );
    if (amount > 0) {
      await consumeCredits({ userId, amount, type: "AI_GENERATION", description: "Brand logo generation" }, tx);
    }
    return tx.brandKit.upsert({
      where: { userId },
      create: { userId, logoAssetId: asset.id },
      update: { logoAssetId: asset.id },
    });
  });
}

const HEX_COLOR_REGEX = /#[0-9a-fA-F]{6}/g;

export async function generateBrandPalette(userId: string, input: GenerateBrandPaletteInput) {
  const tool = await getTool("brand_palette");
  const amount = tool.creditCostEstimate;
  if (amount > 0) {
    const balance = await getCreditBalance(userId);
    if (balance < amount) throw new InsufficientCreditsError(amount, balance);
  }

  const moodPart = input.mood ? ` with a ${input.mood.toLowerCase()} mood` : "";
  const prompt = [
    tool.promptTemplate,
    `Suggest a 2-color brand palette for "${input.businessName}"${moodPart}. Respond with exactly two hex color codes (e.g. #1A2B3C), the primary color first and the secondary color second, and nothing else.`,
  ]
    .filter(Boolean)
    .join(" ");

  const result = await generateScript(
    { prompt, contentLanguage: "EN" },
    { userId },
    "brand_palette",
    tool.defaultProviderId ?? undefined
  );

  // Defensive parse — not every provider (and never the Mock adapter)
  // reliably returns ONLY the two hex codes asked for, so fall back to a
  // sane default pair rather than writing a malformed color into BrandKit.
  const matches = result.text.match(HEX_COLOR_REGEX) ?? [];
  const primaryColor = matches[0] ?? "#6366F1";
  const secondaryColor = matches[1] ?? "#A855F7";

  return prisma.$transaction(async (tx) => {
    if (amount > 0) {
      await consumeCredits({ userId, amount, type: "AI_GENERATION", description: "Brand palette generation" }, tx);
    }
    return tx.brandKit.upsert({
      where: { userId },
      create: { userId, primaryColor, secondaryColor },
      update: { primaryColor, secondaryColor },
    });
  });
}

export async function generateBrandGuidelines(userId: string, input: GenerateBrandGuidelinesInput) {
  const tool = await getTool("brand_guidelines");
  const amount = tool.creditCostEstimate;
  if (amount > 0) {
    const balance = await getCreditBalance(userId);
    if (balance < amount) throw new InsufficientCreditsError(amount, balance);
  }

  const industryPart = input.industry ? ` in the ${input.industry} industry` : "";
  const tonePart = input.toneDescription ? ` Tone of voice: ${input.toneDescription}.` : "";
  const prompt = [
    tool.promptTemplate,
    `Write concise brand guidelines for "${input.businessName}"${industryPart}, covering tone of voice, visual style, and do's/don'ts for marketing content.${tonePart}`,
  ]
    .filter(Boolean)
    .join(" ");

  const result = await generateScript(
    { prompt, contentLanguage: "EN" },
    { userId },
    "brand_guidelines",
    tool.defaultProviderId ?? undefined
  );

  return prisma.$transaction(async (tx) => {
    if (amount > 0) {
      await consumeCredits({ userId, amount, type: "AI_GENERATION", description: "Brand guidelines generation" }, tx);
    }
    return tx.brandKit.upsert({
      where: { userId },
      create: { userId, guidelinesText: result.text },
      update: { guidelinesText: result.text },
    });
  });
}
