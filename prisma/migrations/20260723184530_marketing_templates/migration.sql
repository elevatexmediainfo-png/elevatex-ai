-- CreateEnum
CREATE TYPE "MarketingTemplateOutputType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "marketing_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "outputType" "MarketingTemplateOutputType" NOT NULL,
    "aspectRatio" "AspectRatio" NOT NULL,
    "referenceMediaAssetId" TEXT,
    "promptTemplate" TEXT NOT NULL DEFAULT '',
    "preferredProviderId" TEXT,
    "creditCost" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_template_generations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "filledFields" JSONB NOT NULL,
    "logoAssetId" TEXT,
    "status" "CreativeProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "creditCost" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "resultEditorAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_template_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketing_templates_outputType_isActive_sortOrder_idx" ON "marketing_templates"("outputType", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "marketing_template_generations_userId_createdAt_idx" ON "marketing_template_generations"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "marketing_templates" ADD CONSTRAINT "marketing_templates_referenceMediaAssetId_fkey" FOREIGN KEY ("referenceMediaAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_template_generations" ADD CONSTRAINT "marketing_template_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_template_generations" ADD CONSTRAINT "marketing_template_generations_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "marketing_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_template_generations" ADD CONSTRAINT "marketing_template_generations_logoAssetId_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_template_generations" ADD CONSTRAINT "marketing_template_generations_resultEditorAssetId_fkey" FOREIGN KEY ("resultEditorAssetId") REFERENCES "editor_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
