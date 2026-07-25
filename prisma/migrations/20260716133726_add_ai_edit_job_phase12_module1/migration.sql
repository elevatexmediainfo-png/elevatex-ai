-- CreateEnum
CREATE TYPE "AiEditJobStatus" AS ENUM ('QUEUED', 'UPLOADING', 'TRANSCRIBING', 'ANALYZING_VIDEO', 'PLANNING_REMOVALS', 'PLANNING_TIMELINE', 'RESOLVING_ASSETS', 'BUILDING_TIMELINE', 'READY_FOR_REVIEW', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ai_edit_jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AiEditJobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "timelinePlan" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_edit_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_edit_jobs_projectId_createdAt_idx" ON "ai_edit_jobs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_edit_jobs_userId_idx" ON "ai_edit_jobs"("userId");

-- CreateIndex
CREATE INDEX "ai_edit_jobs_status_idx" ON "ai_edit_jobs"("status");

-- AddForeignKey
ALTER TABLE "ai_edit_jobs" ADD CONSTRAINT "ai_edit_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "editor_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_edit_jobs" ADD CONSTRAINT "ai_edit_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
