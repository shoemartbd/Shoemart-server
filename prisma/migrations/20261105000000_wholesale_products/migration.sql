-- CreateTable
CREATE TABLE "wholesale_products" (
    "id" TEXT NOT NULL,
    "codeNo" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "images" TEXT[],
    "colors" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesale_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wholesale_products_codeNo_key" ON "wholesale_products"("codeNo");

-- CreateIndex
CREATE INDEX "wholesale_products_categoryId_idx" ON "wholesale_products"("categoryId");

-- CreateIndex
CREATE INDEX "wholesale_products_isActive_createdAt_idx" ON "wholesale_products"("isActive", "createdAt");

-- AddForeignKey
ALTER TABLE "wholesale_products" ADD CONSTRAINT "wholesale_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
