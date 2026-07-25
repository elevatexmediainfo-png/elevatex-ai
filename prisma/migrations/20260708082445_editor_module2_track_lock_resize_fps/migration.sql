-- AlterTable
ALTER TABLE "editor_projects" ADD COLUMN     "fps" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "editor_tracks" ADD COLUMN     "heightPx" INTEGER NOT NULL DEFAULT 52,
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false;
