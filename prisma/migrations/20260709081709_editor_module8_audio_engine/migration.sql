-- AlterTable
ALTER TABLE "editor_assets" ADD COLUMN     "waveformPeaks" JSONB;

-- AlterTable
ALTER TABLE "editor_tracks" ADD COLUMN     "soloed" BOOLEAN NOT NULL DEFAULT false;
