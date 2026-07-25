-- AlterTable
ALTER TABLE "editor_tracks" ADD COLUMN     "duckingAmountDb" DOUBLE PRECISION NOT NULL DEFAULT -12,
ADD COLUMN     "duckingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "duckingFadeMs" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "duckingVoiceTrackIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
