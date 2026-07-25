-- AlterTable
ALTER TABLE "creative_projects" ADD COLUMN     "logoAssetId" TEXT,
ADD COLUMN     "referenceAssetId" TEXT,
ADD COLUMN     "targetHeight" INTEGER,
ADD COLUMN     "targetWidth" INTEGER;

-- AddForeignKey
ALTER TABLE "creative_projects" ADD CONSTRAINT "creative_projects_referenceAssetId_fkey" FOREIGN KEY ("referenceAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_projects" ADD CONSTRAINT "creative_projects_logoAssetId_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
