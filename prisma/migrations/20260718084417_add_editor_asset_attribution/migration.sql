-- AlterTable
ALTER TABLE "editor_assets" ADD COLUMN     "attribution" TEXT,
ADD COLUMN     "attributionRequired" BOOLEAN NOT NULL DEFAULT false;
