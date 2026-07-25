-- CreateEnum
CREATE TYPE "SceneStatus" AS ENUM ('PENDING', 'RENDERING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SceneTransition" AS ENUM ('CUT', 'FADE', 'DISSOLVE', 'SLIDE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RenderJobStatus" ADD VALUE 'PAUSED';
ALTER TYPE "RenderJobStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "VideoProjectStatus" ADD VALUE 'PAUSED';

-- AlterTable
ALTER TABLE "generation_logs" ADD COLUMN     "sceneId" TEXT;

-- AlterTable
ALTER TABLE "render_jobs" ADD COLUMN     "sceneId" TEXT;

-- AlterTable
ALTER TABLE "video_projects" ADD COLUMN     "mergeQueued" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "videoProjectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "durationSeconds" INTEGER NOT NULL,
    "imageKey" TEXT,
    "videoKey" TEXT,
    "voiceKey" TEXT,
    "subtitleKey" TEXT,
    "subtitleText" TEXT,
    "backgroundMusicUrl" TEXT,
    "transition" "SceneTransition" NOT NULL DEFAULT 'CUT',
    "status" "SceneStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scenes_videoProjectId_status_idx" ON "scenes"("videoProjectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "scenes_videoProjectId_order_key" ON "scenes"("videoProjectId", "order");

-- CreateIndex
CREATE INDEX "generation_logs_sceneId_idx" ON "generation_logs"("sceneId");

-- CreateIndex
CREATE INDEX "render_jobs_sceneId_idx" ON "render_jobs"("sceneId");

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_logs" ADD CONSTRAINT "generation_logs_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
