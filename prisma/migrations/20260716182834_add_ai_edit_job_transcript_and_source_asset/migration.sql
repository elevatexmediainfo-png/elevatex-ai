/*
  Warnings:

  - Added the required column `sourceAssetId` to the `ai_edit_jobs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ai_edit_jobs" ADD COLUMN     "sourceAssetId" TEXT NOT NULL,
ADD COLUMN     "transcript" JSONB;
