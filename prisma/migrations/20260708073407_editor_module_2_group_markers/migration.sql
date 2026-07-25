-- AlterTable
ALTER TABLE "editor_clips" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "editor_markers" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "timeMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editor_markers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "editor_markers_projectId_idx" ON "editor_markers"("projectId");

-- CreateIndex
CREATE INDEX "editor_clips_projectId_groupId_idx" ON "editor_clips"("projectId", "groupId");

-- AddForeignKey
ALTER TABLE "editor_markers" ADD CONSTRAINT "editor_markers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "editor_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
