import { CreativeStudio } from "@/components/creative/creative-studio";
import { prisma } from "@/lib/prisma";

export default async function CreateSocialPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string }>;
}) {
  const { preset } = await searchParams;
  const tool = await prisma.creativeTool.findUnique({ where: { key: "social_media" } });
  return (
    <CreativeStudio
      kind="SOCIAL_MEDIA"
      initialPresetKey={preset}
      estimatedSeconds={tool?.estimatedSeconds ?? 20}
    />
  );
}
