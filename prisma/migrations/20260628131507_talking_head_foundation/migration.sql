-- CreateEnum
CREATE TYPE "VideoProjectSourceType" AS ENUM ('GENERATED', 'TALKING_HEAD_UPLOAD');

-- CreateEnum
CREATE TYPE "SceneVisualType" AS ENUM ('FACE_ONLY', 'B_ROLL', 'IMAGE', 'LOGO', 'SCREENSHOT', 'WEBSITE', 'GRAPH', 'CHART', 'ICON', 'ANIMATION', 'TEXT_OVERLAY');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('PENDING_UPLOAD', 'READY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CreditTransactionType" ADD VALUE 'AI_GENERATION';
ALTER TYPE "CreditTransactionType" ADD VALUE 'EXPORT';

-- AlterEnum
ALTER TYPE "GenerationCategory" ADD VALUE 'TRANSCRIPTION';

-- AlterEnum
ALTER TYPE "ProviderCategory" ADD VALUE 'TRANSCRIPTION';

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "durationSeconds" DOUBLE PRECISION,
ADD COLUMN     "fileSizeBytes" INTEGER,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "status" "AssetStatus" NOT NULL DEFAULT 'READY';

-- AlterTable
ALTER TABLE "caption_words" ADD COLUMN     "emphasis" TEXT,
ADD COLUMN     "highlightColor" TEXT;

-- AlterTable
ALTER TABLE "scenes" ADD COLUMN     "visualType" "SceneVisualType";

-- AlterTable
ALTER TABLE "video_projects" ADD COLUMN     "sourceAssetId" TEXT,
ADD COLUMN     "sourceType" "VideoProjectSourceType" NOT NULL DEFAULT 'GENERATED',
ALTER COLUMN "brief" DROP NOT NULL;

-- CreateTable
CREATE TABLE "transcripts" (
    "id" TEXT NOT NULL,
    "videoProjectId" TEXT NOT NULL,
    "sourceAssetId" TEXT NOT NULL,
    "language" TEXT,
    "durationSeconds" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_segments" (
    "id" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "paragraphIndex" INTEGER NOT NULL DEFAULT 0,
    "wordTimings" JSONB NOT NULL,
    "analysis" JSONB,
    "sceneId" TEXT,

    CONSTRAINT "transcript_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_kits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "logoAssetId" TEXT,
    "introAnimationId" TEXT,
    "musicAssetId" TEXT,
    "outroAssetId" TEXT,
    "watermarkAssetId" TEXT,
    "watermarkPosition" TEXT DEFAULT 'bottom_right',
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "fontFamily" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_kits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transcripts_videoProjectId_key" ON "transcripts"("videoProjectId");

-- CreateIndex
CREATE INDEX "transcript_segments_sceneId_idx" ON "transcript_segments"("sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_segments_transcriptId_order_key" ON "transcript_segments"("transcriptId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "brand_kits_userId_key" ON "brand_kits"("userId");

-- AddForeignKey
ALTER TABLE "video_projects" ADD CONSTRAINT "video_projects_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "transcripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
