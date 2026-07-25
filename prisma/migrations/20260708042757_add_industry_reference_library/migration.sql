-- CreateEnum
CREATE TYPE "ReferenceAnalysisStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "industry_references" (
    "id" TEXT NOT NULL,
    "industry" "BusinessVertical" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "label" TEXT,
    "analysisStatus" "ReferenceAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "analysis" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industry_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industry_guidance_notes" (
    "id" TEXT NOT NULL,
    "industry" "BusinessVertical" NOT NULL,
    "notes" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industry_guidance_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "industry_references_industry_isActive_idx" ON "industry_references"("industry", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "industry_guidance_notes_industry_key" ON "industry_guidance_notes"("industry");

-- AddForeignKey
ALTER TABLE "industry_references" ADD CONSTRAINT "industry_references_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
