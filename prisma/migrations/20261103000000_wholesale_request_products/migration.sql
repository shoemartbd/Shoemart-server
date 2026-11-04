-- AlterTable
ALTER TABLE "wholesale_requests" ADD COLUMN     "products" JSONB NOT NULL DEFAULT '[]';
