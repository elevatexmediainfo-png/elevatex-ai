-- CreateEnum
CREATE TYPE "VideoPlatform" AS ENUM ('INSTAGRAM_REEL', 'INSTAGRAM_POST', 'FACEBOOK', 'YOUTUBE_SHORTS', 'WHATSAPP_STATUS', 'GOOGLE_BUSINESS');

-- CreateEnum
CREATE TYPE "AspectRatio" AS ENUM ('RATIO_9_16', 'RATIO_1_1', 'RATIO_16_9');

-- CreateEnum
CREATE TYPE "VideoObjective" AS ENUM ('PROMOTION', 'NEW_LAUNCH', 'FESTIVAL_GREETING', 'TESTIMONIAL', 'ANNOUNCEMENT', 'OFFER_DISCOUNT', 'BRAND_AWARENESS');

-- CreateEnum
CREATE TYPE "VideoProjectStatus" AS ENUM ('DRAFT', 'SCRIPT_READY', 'QUEUED', 'RENDERING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RenderJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('SIGNUP_BONUS', 'VIDEO_GENERATION', 'REFUND', 'PURCHASE', 'ADMIN_ADJUSTMENT');

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "vertical" "BusinessVertical" NOT NULL,
    "platform" "VideoPlatform" NOT NULL,
    "aspectRatio" "AspectRatio" NOT NULL,
    "durationSeconds" INTEGER NOT NULL DEFAULT 30,
    "thumbnailUrl" TEXT,
    "creditCost" INTEGER NOT NULL DEFAULT 1,
    "promptTemplate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "objective" "VideoObjective" NOT NULL,
    "platform" "VideoPlatform" NOT NULL,
    "aspectRatio" "AspectRatio" NOT NULL,
    "contentLanguage" "ContentLanguage" NOT NULL DEFAULT 'EN',
    "brief" JSONB NOT NULL,
    "generatedScript" TEXT,
    "status" "VideoProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "creditCost" INTEGER NOT NULL DEFAULT 1,
    "outputVideoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "durationSeconds" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "render_jobs" (
    "id" TEXT NOT NULL,
    "videoProjectId" TEXT NOT NULL,
    "status" "RenderJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "errorMessage" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "render_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoProjectId" TEXT,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "templates_vertical_platform_idx" ON "templates"("vertical", "platform");

-- CreateIndex
CREATE INDEX "video_projects_userId_status_idx" ON "video_projects"("userId", "status");

-- CreateIndex
CREATE INDEX "video_projects_userId_createdAt_idx" ON "video_projects"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "render_jobs_status_scheduledAt_idx" ON "render_jobs"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "credit_transactions_userId_createdAt_idx" ON "credit_transactions"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "video_projects" ADD CONSTRAINT "video_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_projects" ADD CONSTRAINT "video_projects_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
