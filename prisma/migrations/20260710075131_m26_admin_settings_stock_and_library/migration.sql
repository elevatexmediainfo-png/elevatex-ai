-- CreateEnum
CREATE TYPE "EditorAssetScope" AS ENUM ('USER', 'LIBRARY');

-- CreateEnum
CREATE TYPE "LibraryAssetCategory" AS ENUM ('VIDEO', 'IMAGE', 'AUDIO', 'SFX', 'MUSIC', 'ANIMATION', 'STATIC_ICON', 'ANIMATED_ICON');

-- AlterEnum
ALTER TYPE "EditorAssetKind" ADD VALUE 'ANIMATION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProviderCategory" ADD VALUE 'STOCK_MEDIA';
ALTER TYPE "ProviderCategory" ADD VALUE 'ICON';

-- DropForeignKey
ALTER TABLE "editor_assets" DROP CONSTRAINT "editor_assets_userId_fkey";

-- AlterTable
ALTER TABLE "editor_assets" ADD COLUMN     "libraryCategory" "LibraryAssetCategory",
ADD COLUMN     "scope" "EditorAssetScope" NOT NULL DEFAULT 'USER',
ADD COLUMN     "thumbnailKey" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "editor_assets_scope_libraryCategory_createdAt_idx" ON "editor_assets"("scope", "libraryCategory", "createdAt");

-- AddForeignKey
ALTER TABLE "editor_assets" ADD CONSTRAINT "editor_assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
