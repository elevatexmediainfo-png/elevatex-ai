-- CreateTable
CREATE TABLE "editor_project_versions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editor_project_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "editor_project_versions_projectId_createdAt_idx" ON "editor_project_versions"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "editor_project_versions" ADD CONSTRAINT "editor_project_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "editor_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
