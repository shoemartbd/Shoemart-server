-- AlterEnum
ALTER TYPE "WholesaleRequestStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "wholesale_requests" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "deliveryCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "invoiceNo" SERIAL NOT NULL,
ADD COLUMN     "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "wholesale_requests_invoiceNo_key" ON "wholesale_requests"("invoiceNo");

-- CreateIndex
CREATE INDEX "wholesale_requests_status_completedAt_idx" ON "wholesale_requests"("status", "completedAt");
