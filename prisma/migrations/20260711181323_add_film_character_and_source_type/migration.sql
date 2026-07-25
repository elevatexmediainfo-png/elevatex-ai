-- CreateEnum
CREATE TYPE "FilmCharacterStatus" AS ENUM ('PENDING', 'VARIATIONS_READY', 'FACE_UPLOADED', 'SELECTED', 'SHEET_READY');

-- AlterEnum
ALTER TYPE "VideoProjectSourceType" ADD VALUE 'FILM';

-- AlterTable
ALTER TABLE "scenes" ADD COLUMN     "filmCharacterId" TEXT;

-- CreateTable
CREATE TABLE "film_characters" (
    "id" TEXT NOT NULL,
    "videoProjectId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "name" TEXT,
    "variationAssetIds" JSONB,
    "selectedVariationAssetId" TEXT,
    "faceUploadSideAssetId" TEXT,
    "faceUploadFrontAssetId" TEXT,
    "characterSheet" JSONB,
    "status" "FilmCharacterStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "film_characters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "film_characters_videoProjectId_slotIndex_key" ON "film_characters"("videoProjectId", "slotIndex");

-- AddForeignKey
ALTER TABLE "film_characters" ADD CONSTRAINT "film_characters_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_filmCharacterId_fkey" FOREIGN KEY ("filmCharacterId") REFERENCES "film_characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
