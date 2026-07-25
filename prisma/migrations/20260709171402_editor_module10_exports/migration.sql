-- CreateEnum
CREATE TYPE "EditorExportFormat" AS ENUM ('MP4', 'MOV', 'WEBM', 'GIF');

-- CreateEnum
CREATE TYPE "EditorExportResolution" AS ENUM ('R720P', 'R1080P', 'R2K', 'R4K');

-- CreateEnum
CREATE TYPE "EditorExportCodec" AS ENUM ('H264', 'H265', 'VP9');

-- CreateEnum
CREATE TYPE "EditorExportStatus" AS ENUM ('QUEUED', 'RENDERING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "editor_exports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "format" "EditorExportFormat" NOT NULL,
    "resolution" "EditorExportResolution" NOT NULL,
    "fps" INTEGER NOT NULL,
    "bitrateKbps" INTEGER,
    "codec" "EditorExportCodec",
    "status" "EditorExportStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalFrames" INTEGER,
    "framesRendered" INTEGER NOT NULL DEFAULT 0,
    "outputKey" TEXT,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editor_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "editor_exports_projectId_createdAt_idx" ON "editor_exports"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "editor_exports_userId_idx" ON "editor_exports"("userId");

-- CreateIndex
CREATE INDEX "editor_exports_status_idx" ON "editor_exports"("status");

-- AddForeignKey
ALTER TABLE "editor_exports" ADD CONSTRAINT "editor_exports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "editor_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_exports" ADD CONSTRAINT "editor_exports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
