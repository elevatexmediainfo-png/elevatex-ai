-- AlterTable
ALTER TABLE "editor_assets" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "editor_assets_projectId_kind_createdAt_idx" ON "editor_assets"("projectId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "editor_assets" ADD CONSTRAINT "editor_assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "editor_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
