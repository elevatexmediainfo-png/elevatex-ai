-- AlterTable
ALTER TABLE "otp_requests" ADD COLUMN     "ipAddress" TEXT;

-- CreateIndex
CREATE INDEX "otp_requests_ipAddress_createdAt_idx" ON "otp_requests"("ipAddress", "createdAt");
