-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'WHOLESALER';

-- AlterTable
ALTER TABLE "wholesale_requests" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "wholesale_requests_userId_idx" ON "wholesale_requests"("userId");

-- AddForeignKey
ALTER TABLE "wholesale_requests" ADD CONSTRAINT "wholesale_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
