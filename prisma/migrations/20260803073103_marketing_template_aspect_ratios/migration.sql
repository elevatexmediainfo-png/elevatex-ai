-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AspectRatio" ADD VALUE 'RATIO_4_5';
ALTER TYPE "AspectRatio" ADD VALUE 'RATIO_3_4';
ALTER TYPE "AspectRatio" ADD VALUE 'RATIO_2_3';
ALTER TYPE "AspectRatio" ADD VALUE 'RATIO_3_2';
ALTER TYPE "AspectRatio" ADD VALUE 'RATIO_4_3';
