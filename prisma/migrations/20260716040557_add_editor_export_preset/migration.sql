-- CreateTable
CREATE TABLE "editor_export_presets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" "EditorExportFormat" NOT NULL,
    "resolution" "EditorExportResolution" NOT NULL,
    "fps" INTEGER NOT NULL,
    "bitrateKbps" INTEGER,
    "codec" "EditorExportCodec",
    "watermark" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editor_export_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "editor_export_presets_userId_idx" ON "editor_export_presets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "editor_export_presets_userId_name_key" ON "editor_export_presets"("userId", "name");

-- AddForeignKey
ALTER TABLE "editor_export_presets" ADD CONSTRAINT "editor_export_presets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
