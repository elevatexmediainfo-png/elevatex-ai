-- CreateEnum
CREATE TYPE "CreativeProjectKind" AS ENUM ('AI_IMAGE', 'SOCIAL_MEDIA', 'MARKETING_CREATIVE');

-- CreateEnum
CREATE TYPE "CreativeProjectStatus" AS ENUM ('DRAFT', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CreativeToolCategory" AS ENUM ('MAIN_CARD', 'QUICK_ACTION', 'COMING_SOON');

-- CreateEnum
CREATE TYPE "CreativeToolPipeline" AS ENUM ('VIDEO', 'IMAGE', 'SOCIAL_MEDIA', 'MARKETING_CREATIVE', 'TALKING_HEAD', 'BRAND_ASSET', 'EXTERNAL');

-- AlterEnum
ALTER TYPE "BusinessVertical" ADD VALUE 'FINANCE';

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "creativeProjectId" TEXT;

-- AlterTable
ALTER TABLE "brand_kits" ADD COLUMN     "guidelinesText" TEXT;

-- AlterTable
ALTER TABLE "credit_transactions" ADD COLUMN     "creativeProjectId" TEXT;

-- AlterTable
ALTER TABLE "generation_logs" ADD COLUMN     "creativeProjectId" TEXT;

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "defaultObjective" "VideoObjective",
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "creative_projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "CreativeProjectKind" NOT NULL,
    "preset" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "aspectRatio" "AspectRatio" NOT NULL,
    "contentLanguage" "ContentLanguage" NOT NULL DEFAULT 'EN',
    "status" "CreativeProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "creditCost" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "resultAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_tools" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL,
    "gradientFrom" TEXT,
    "gradientTo" TEXT,
    "category" "CreativeToolCategory" NOT NULL,
    "pipeline" "CreativeToolPipeline" NOT NULL,
    "presetKey" TEXT,
    "routeOverride" TEXT,
    "creditCostEstimate" INTEGER NOT NULL DEFAULT 0,
    "estimatedSeconds" INTEGER NOT NULL DEFAULT 0,
    "promptTemplate" TEXT,
    "defaultProviderId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_tools_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creative_projects_userId_kind_createdAt_idx" ON "creative_projects"("userId", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "creative_tools_key_key" ON "creative_tools"("key");

-- CreateIndex
CREATE INDEX "creative_tools_category_sortOrder_idx" ON "creative_tools"("category", "sortOrder");

-- CreateIndex
CREATE INDEX "assets_creativeProjectId_idx" ON "assets"("creativeProjectId");

-- CreateIndex
CREATE INDEX "generation_logs_creativeProjectId_idx" ON "generation_logs"("creativeProjectId");

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "creative_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_logs" ADD CONSTRAINT "generation_logs_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "creative_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_projects" ADD CONSTRAINT "creative_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_projects" ADD CONSTRAINT "creative_projects_resultAssetId_fkey" FOREIGN KEY ("resultAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "creative_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
