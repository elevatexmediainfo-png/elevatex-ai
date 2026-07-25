import { prisma } from "@/lib/prisma";
import { InvalidStateError } from "./errors";
import { isValidCodecForFormat, resolveCodec, type ExportCodec, type ExportFormat, type ExportResolution } from "./export-engine";

// Render Queue polish (2026-07-16) — user-saved, reusable export settings
// ("my TikTok settings"). Scoped to the user, not one project — see the
// Prisma schema's EditorExportPreset doc comment for the full reasoning.
// Deliberately a small, plain CRUD service (create/list/delete only, no
// update — re-saving under the same name or deleting-and-recreating covers
// "I want to change my saved settings" without a 4th operation).

export interface CreateExportPresetInput {
  userId: string;
  name: string;
  format: ExportFormat;
  resolution: ExportResolution;
  fps: number;
  bitrateKbps?: number;
  codec?: ExportCodec;
  watermark?: boolean;
}

export async function createExportPreset(input: CreateExportPresetInput) {
  const existing = await prisma.editorExportPreset.findUnique({
    where: { userId_name: { userId: input.userId, name: input.name } },
  });
  if (existing) {
    throw new InvalidStateError(`You already have a saved export preset named "${input.name}".`);
  }

  if (input.codec && !isValidCodecForFormat(input.format, input.codec)) {
    throw new InvalidStateError(`${input.codec} is not a valid codec for ${input.format}.`);
  }
  const codec = resolveCodec(input.format, input.codec);

  return prisma.editorExportPreset.create({
    data: {
      userId: input.userId,
      name: input.name,
      format: input.format,
      resolution: input.resolution,
      fps: input.fps,
      bitrateKbps: input.bitrateKbps,
      codec: codec ?? undefined,
      watermark: input.watermark ?? false,
    },
  });
}

export async function listExportPresets(userId: string) {
  return prisma.editorExportPreset.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function deleteExportPreset(userId: string, presetId: string): Promise<void> {
  const claim = await prisma.editorExportPreset.deleteMany({ where: { id: presetId, userId } });
  if (claim.count === 0) throw new InvalidStateError("Export preset not found.");
}
