import { CreativeStudio } from "@/components/creative/creative-studio";
import { prisma } from "@/lib/prisma";

export default async function CreateMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string }>;
}) {
  const { preset } = await searchParams;
  const tool = await prisma.creativeTool.findUnique({ where: { key: "marketing_creative" } });
  return (
    <CreativeStudio
      kind="MARKETING_CREATIVE"
      initialPresetKey={preset}
      estimatedSeconds={tool?.estimatedSeconds ?? 20}
    />
  );
}
