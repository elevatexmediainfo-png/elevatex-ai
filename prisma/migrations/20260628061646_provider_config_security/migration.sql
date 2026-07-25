-- CreateEnum
CREATE TYPE "ProviderCategory" AS ENUM ('LLM', 'IMAGE', 'VOICE', 'VIDEO', 'STORAGE', 'PAYMENT');

-- CreateTable
CREATE TABLE "provider_configs" (
    "id" TEXT NOT NULL,
    "category" "ProviderCategory" NOT NULL,
    "providerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "apiKeyEncrypted" TEXT,
    "apiSecretEncrypted" TEXT,
    "model" TEXT,
    "defaultQuality" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "monthlyBudgetUsd" DOUBLE PRECISION,
    "dailyBudgetUsd" DOUBLE PRECISION,
    "rateLimitPerMinute" INTEGER,
    "timeoutMs" INTEGER,
    "retryCount" INTEGER,
    "keyExpiresAt" TIMESTAMP(3),
    "lastTestedAt" TIMESTAMP(3),
    "lastTestResult" BOOLEAN,
    "lastTestError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_audit_logs" (
    "id" TEXT NOT NULL,
    "category" "ProviderCategory" NOT NULL,
    "providerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_configs_category_providerId_key" ON "provider_configs"("category", "providerId");

-- CreateIndex
CREATE INDEX "provider_audit_logs_category_providerId_createdAt_idx" ON "provider_audit_logs"("category", "providerId", "createdAt");
