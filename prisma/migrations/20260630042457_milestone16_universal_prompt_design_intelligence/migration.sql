-- AlterTable
ALTER TABLE "creative_projects" ADD COLUMN     "universalPrompt" JSONB;

-- CreateTable
CREATE TABLE "asset_analyses" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "industry" TEXT,
    "category" TEXT,
    "style" TEXT,
    "mood" TEXT,
    "platform" TEXT,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_analyses_assetId_key" ON "asset_analyses"("assetId");

-- AddForeignKey
ALTER TABLE "asset_analyses" ADD CONSTRAINT "asset_analyses_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
