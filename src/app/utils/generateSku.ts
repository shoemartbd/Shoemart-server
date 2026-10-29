import { PrismaClient } from "../../generated/prisma/client";

/**
 * Generates a random 6-digit numeric SKU/barcode, e.g. "042871".
 */
const randomSixDigits = (): string =>
  Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");

/**
 * Generates a random 6-digit SKU that doesn't collide with an existing
 * product SKU or product variant SKU (SKUs are unique across both).
 *
 * @param excludeProductId - current product's id to exclude during update operations
 * @param excludeVariantId - current variant's id to exclude during update operations
 */
export const generateUniqueSku = async (
  prisma: Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  excludeProductId?: string,
  excludeVariantId?: string,
): Promise<string> => {
  const MAX_ATTEMPTS = 20;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const sku = randomSixDigits();

    const [productMatch, variantMatch] = await Promise.all([
      prisma.product.findUnique({ where: { sku }, select: { id: true } }),
      prisma.productVariant.findUnique({ where: { sku }, select: { id: true } }),
    ]);

    const productConflict = productMatch && productMatch.id !== excludeProductId;
    const variantConflict = variantMatch && variantMatch.id !== excludeVariantId;

    if (!productConflict && !variantConflict) {
      return sku;
    }
  }

  throw new Error("Failed to generate a unique SKU after multiple attempts");
};
