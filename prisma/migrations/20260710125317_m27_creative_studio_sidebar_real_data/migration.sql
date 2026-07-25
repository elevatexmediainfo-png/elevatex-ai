-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LibraryAssetCategory" ADD VALUE 'TEMPLATE';
ALTER TYPE "LibraryAssetCategory" ADD VALUE 'TRANSITION';
ALTER TYPE "LibraryAssetCategory" ADD VALUE 'EFFECT';
ALTER TYPE "LibraryAssetCategory" ADD VALUE 'SHAPE';
ALTER TYPE "LibraryAssetCategory" ADD VALUE 'STICKER';
ALTER TYPE "LibraryAssetCategory" ADD VALUE 'LOGO';

-- CreateTable
CREATE TABLE "editor_asset_favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editor_asset_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_collections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editor_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_collection_assets" (
    "collectionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editor_collection_assets_pkey" PRIMARY KEY ("collectionId","assetId")
);

-- CreateIndex
CREATE UNIQUE INDEX "editor_asset_favorites_userId_assetId_key" ON "editor_asset_favorites"("userId", "assetId");

-- CreateIndex
CREATE INDEX "editor_collections_userId_createdAt_idx" ON "editor_collections"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "editor_asset_favorites" ADD CONSTRAINT "editor_asset_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_asset_favorites" ADD CONSTRAINT "editor_asset_favorites_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "editor_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_collections" ADD CONSTRAINT "editor_collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_collection_assets" ADD CONSTRAINT "editor_collection_assets_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "editor_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_collection_assets" ADD CONSTRAINT "editor_collection_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "editor_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
