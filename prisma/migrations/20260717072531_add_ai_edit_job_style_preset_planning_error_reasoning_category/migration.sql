-- AlterEnum
ALTER TYPE "GenerationCategory" ADD VALUE 'REASONING';

-- AlterTable
ALTER TABLE "ai_edit_jobs" ADD COLUMN     "planningError" TEXT,
ADD COLUMN     "stylePreset" TEXT;
