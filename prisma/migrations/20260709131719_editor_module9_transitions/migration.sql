-- CreateEnum
CREATE TYPE "EditorTransitionType" AS ENUM ('CROSSFADE', 'DISSOLVE', 'WIPE', 'SLIDE', 'ZOOM', 'FLASH');

-- CreateEnum
CREATE TYPE "EditorTransitionDirection" AS ENUM ('LEFT', 'RIGHT', 'UP', 'DOWN', 'IN', 'OUT');

-- CreateTable
CREATE TABLE "editor_transitions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "clipAId" TEXT NOT NULL,
    "clipBId" TEXT NOT NULL,
    "type" "EditorTransitionType" NOT NULL,
    "direction" "EditorTransitionDirection",
    "durationMs" INTEGER NOT NULL,
    "easing" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editor_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "editor_transitions_projectId_idx" ON "editor_transitions"("projectId");

-- CreateIndex
CREATE INDEX "editor_transitions_trackId_idx" ON "editor_transitions"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "editor_transitions_clipAId_key" ON "editor_transitions"("clipAId");

-- CreateIndex
CREATE UNIQUE INDEX "editor_transitions_clipBId_key" ON "editor_transitions"("clipBId");

-- AddForeignKey
ALTER TABLE "editor_transitions" ADD CONSTRAINT "editor_transitions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "editor_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_transitions" ADD CONSTRAINT "editor_transitions_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "editor_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_transitions" ADD CONSTRAINT "editor_transitions_clipAId_fkey" FOREIGN KEY ("clipAId") REFERENCES "editor_clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_transitions" ADD CONSTRAINT "editor_transitions_clipBId_fkey" FOREIGN KEY ("clipBId") REFERENCES "editor_clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
