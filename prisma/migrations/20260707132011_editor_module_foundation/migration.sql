-- CreateEnum
CREATE TYPE "EditorAspectRatio" AS ENUM ('RATIO_16_9', 'RATIO_9_16', 'RATIO_1_1', 'RATIO_4_5', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EditorAssetKind" AS ENUM ('VIDEO', 'AUDIO', 'IMAGE');

-- CreateEnum
CREATE TYPE "EditorAssetStatus" AS ENUM ('PENDING_UPLOAD', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "EditorTrackKind" AS ENUM ('VIDEO', 'AUDIO', 'SUBTITLE', 'TEXT', 'OVERLAY', 'EFFECTS');

-- CreateTable
CREATE TABLE "editor_folders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editor_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "folderId" TEXT,
    "aspectRatio" "EditorAspectRatio" NOT NULL DEFAULT 'RATIO_16_9',
    "widthPx" INTEGER NOT NULL DEFAULT 1920,
    "heightPx" INTEGER NOT NULL DEFAULT 1080,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "lastOpenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editor_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_assets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "EditorAssetKind" NOT NULL,
    "status" "EditorAssetStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editor_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_tracks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "EditorTrackKind" NOT NULL,
    "order" INTEGER NOT NULL,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editor_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_clips" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assetId" TEXT,
    "startMs" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "trimStartMs" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editor_clips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "editor_folders_userId_parentId_idx" ON "editor_folders"("userId", "parentId");

-- CreateIndex
CREATE INDEX "editor_projects_userId_folderId_idx" ON "editor_projects"("userId", "folderId");

-- CreateIndex
CREATE INDEX "editor_projects_userId_updatedAt_idx" ON "editor_projects"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "editor_assets_userId_kind_createdAt_idx" ON "editor_assets"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "editor_tracks_projectId_idx" ON "editor_tracks"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "editor_tracks_projectId_order_key" ON "editor_tracks"("projectId", "order");

-- CreateIndex
CREATE INDEX "editor_clips_trackId_idx" ON "editor_clips"("trackId");

-- CreateIndex
CREATE INDEX "editor_clips_projectId_idx" ON "editor_clips"("projectId");

-- AddForeignKey
ALTER TABLE "editor_folders" ADD CONSTRAINT "editor_folders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_folders" ADD CONSTRAINT "editor_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "editor_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_projects" ADD CONSTRAINT "editor_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_projects" ADD CONSTRAINT "editor_projects_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "editor_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_assets" ADD CONSTRAINT "editor_assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_tracks" ADD CONSTRAINT "editor_tracks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "editor_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_clips" ADD CONSTRAINT "editor_clips_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "editor_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_clips" ADD CONSTRAINT "editor_clips_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "editor_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_clips" ADD CONSTRAINT "editor_clips_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "editor_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
