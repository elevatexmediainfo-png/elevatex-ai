-- CreateEnum
CREATE TYPE "AssetSource" AS ENUM ('AI_GENERATED', 'UPLOAD', 'STOCK', 'BRAND');

-- CreateEnum
CREATE TYPE "TrackKind" AS ENUM ('VIDEO', 'IMAGE', 'TEXT', 'CAPTION', 'STICKER', 'AUDIO', 'MUSIC');

-- CreateEnum
CREATE TYPE "ExportResolution" AS ENUM ('R720P', 'R1080P', 'R4K');

-- CreateEnum
CREATE TYPE "ExportCodec" AS ENUM ('H264', 'H265', 'VP9');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "AssetKind" ADD VALUE 'STICKER';

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "source" "AssetSource" NOT NULL DEFAULT 'AI_GENERATED';

-- AlterTable
ALTER TABLE "project_collaborators" ADD COLUMN     "lastActiveAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tracks" (
    "id" TEXT NOT NULL,
    "videoProjectId" TEXT NOT NULL,
    "kind" "TrackKind" NOT NULL,
    "order" INTEGER NOT NULL,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clips" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "videoProjectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "assetId" TEXT,
    "startMs" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "trimStartMs" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caption_blocks" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "videoProjectId" TEXT NOT NULL,
    "style" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caption_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caption_words" (
    "id" TEXT NOT NULL,
    "captionBlockId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,

    CONSTRAINT "caption_words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" TEXT NOT NULL,
    "videoProjectId" TEXT NOT NULL,
    "resolution" "ExportResolution" NOT NULL,
    "codec" "ExportCodec" NOT NULL,
    "watermark" BOOLEAN NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "outputKey" TEXT,
    "errorMessage" TEXT,
    "renderJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracks_videoProjectId_idx" ON "tracks"("videoProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_videoProjectId_order_key" ON "tracks"("videoProjectId", "order");

-- CreateIndex
CREATE INDEX "clips_trackId_idx" ON "clips"("trackId");

-- CreateIndex
CREATE INDEX "clips_videoProjectId_idx" ON "clips"("videoProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "caption_blocks_sceneId_key" ON "caption_blocks"("sceneId");

-- CreateIndex
CREATE INDEX "caption_blocks_videoProjectId_idx" ON "caption_blocks"("videoProjectId");

-- CreateIndex
CREATE INDEX "caption_words_captionBlockId_order_idx" ON "caption_words"("captionBlockId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "exports_renderJobId_key" ON "exports"("renderJobId");

-- CreateIndex
CREATE INDEX "exports_videoProjectId_createdAt_idx" ON "exports"("videoProjectId", "createdAt");

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caption_blocks" ADD CONSTRAINT "caption_blocks_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caption_blocks" ADD CONSTRAINT "caption_blocks_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caption_words" ADD CONSTRAINT "caption_words_captionBlockId_fkey" FOREIGN KEY ("captionBlockId") REFERENCES "caption_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_renderJobId_fkey" FOREIGN KEY ("renderJobId") REFERENCES "render_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
