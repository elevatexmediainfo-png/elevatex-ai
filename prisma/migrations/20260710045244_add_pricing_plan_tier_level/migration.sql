-- CreateEnum
CREATE TYPE "PricingTierLevel" AS ENUM ('BASIC', 'PRO', 'PREMIUM');

-- AlterTable
ALTER TABLE "pricing_plans" ADD COLUMN     "tierLevel" "PricingTierLevel";
