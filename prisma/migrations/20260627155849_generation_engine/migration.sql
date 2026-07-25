-- CreateEnum
CREATE TYPE "GenerationCategory" AS ENUM ('LLM', 'IMAGE', 'VOICE', 'VIDEO');

-- CreateEnum
CREATE TYPE "ProviderHealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN');

-- CreateEnum
CREATE TYPE "GenerationLogStatus" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "provider_health" (
    "id" TEXT NOT NULL,
    "category" "GenerationCategory" NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "ProviderHealthStatus" NOT NULL DEFAULT 'HEALTHY',
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastError" TEXT,
    "downUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_logs" (
    "id" TEXT NOT NULL,
    "category" "GenerationCategory" NOT NULL,
    "providerId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" "GenerationLogStatus" NOT NULL,
    "attempt" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "videoProjectId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_health_category_providerId_key" ON "provider_health"("category", "providerId");

-- CreateIndex
CREATE INDEX "generation_logs_category_providerId_createdAt_idx" ON "generation_logs"("category", "providerId", "createdAt");

-- CreateIndex
CREATE INDEX "generation_logs_videoProjectId_idx" ON "generation_logs"("videoProjectId");

-- AddForeignKey
ALTER TABLE "generation_logs" ADD CONSTRAINT "generation_logs_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
