-- Migration v3 (2026-08-02) — Marketing Templates: remove placeholder
-- substitution, add admin-locked Primary/Fallback providers, an
-- independent userAssetRequired toggle, multi-asset ordered references
-- with an optional role, and a Master Prompt snapshot per generation.
-- Hand-written (not prisma migrate dev's auto-diff) so the two renamed
-- columns below use RENAME COLUMN instead of DROP+ADD — preserving real
-- existing data (12 non-null logoAssetId values confirmed live in this
-- database at migration time) rather than silently discarding it.

-- 1. Rename existing columns (data-preserving) --------------------------

ALTER TABLE "marketing_template_generations" RENAME COLUMN "logoAssetId" TO "userAssetId";
ALTER TABLE "marketing_template_generations" RENAME CONSTRAINT "marketing_template_generations_logoAssetId_fkey" TO "marketing_template_generations_userAssetId_fkey";

ALTER TABLE "marketing_templates" RENAME COLUMN "preferredProviderId" TO "primaryProviderId";

-- 2. New columns ----------------------------------------------------------

ALTER TABLE "marketing_templates"
  ADD COLUMN "fallbackProviderId" TEXT,
  ADD COLUMN "userAssetRequired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "marketing_template_generations"
  ADD COLUMN "masterPromptSnapshot" TEXT,
  ALTER COLUMN "filledFields" DROP NOT NULL;

-- 3. New enum + join table -------------------------------------------------

CREATE TYPE "MarketingTemplateAssetRole" AS ENUM ('STYLE', 'COMPOSITION', 'LIGHTING', 'COLOR', 'TYPOGRAPHY', 'BRANDING');

CREATE TABLE "marketing_template_assets" (
    "templateId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "role" "MarketingTemplateAssetRole",
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_template_assets_pkey" PRIMARY KEY ("templateId","assetId")
);

CREATE INDEX "marketing_template_assets_templateId_position_idx" ON "marketing_template_assets"("templateId", "position");

ALTER TABLE "marketing_template_assets" ADD CONSTRAINT "marketing_template_assets_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "marketing_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketing_template_assets" ADD CONSTRAINT "marketing_template_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Backfill: legacy single referenceMediaAssetId -> the new ordered
--    join table, one row each at position 1000 (leaves headroom above and
--    below for a future drag-and-drop insert without renumbering the rest
--    of the list). referenceMediaAssetId itself is left untouched (kept
--    read-only, see schema.prisma's own comment) for backward
--    compatibility with anything still reading it.

INSERT INTO "marketing_template_assets" ("templateId", "assetId", "position")
SELECT "id", "referenceMediaAssetId", 1000
FROM "marketing_templates"
WHERE "referenceMediaAssetId" IS NOT NULL
ON CONFLICT ("templateId", "assetId") DO NOTHING;
