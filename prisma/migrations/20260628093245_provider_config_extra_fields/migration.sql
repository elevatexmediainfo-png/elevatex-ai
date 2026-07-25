-- AlterTable
ALTER TABLE "provider_configs" ADD COLUMN     "extraConfig" JSONB,
ADD COLUMN     "extraSecretEncrypted" TEXT;
