-- AlterTable
ALTER TABLE "generation_logs" ADD COLUMN     "model" TEXT,
ADD COLUMN     "usageImages" INTEGER,
ADD COLUMN     "usageSeconds" DOUBLE PRECISION,
ADD COLUMN     "usageTokens" INTEGER;
