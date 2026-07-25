import { CreativeStudio } from "@/components/creative/creative-studio";
import { prisma } from "@/lib/prisma";

export default async function CreateImagePage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string }>;
}) {
  const { preset } = await searchParams;
  const tool = await prisma.creativeTool.findUnique({ where: { key: "ai_image" } });
  // CreativeStudio is a full-width workspace — no Container constraint.
  return (
    <CreativeStudio
      kind="AI_IMAGE"
      initialPresetKey={preset}
      estimatedSeconds={tool?.estimatedSeconds ?? 20}
    />
  );
}
