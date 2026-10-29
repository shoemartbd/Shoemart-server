import { prisma } from "../../lib/prisma";
import { ProductStatus } from "../../../generated/prisma/enums";
import { cached, invalidates, MINUTE } from "../../utils/memoryCache";

const adminProductSelect = {
  id: true,
  name: true,
  slug: true,
  images: true,
  sellPrice: true,
  regularPrice: true,
  status: true,
};

const productInclude = {
  category: true,
  shop: true,
  variants: true,
};

const ensureFlashSale = async () => {
  let flashSale = await prisma.flashSale.findUnique({
    where: { id: "default" },
  });

  if (!flashSale) {
    flashSale = await prisma.flashSale.create({
      data: { id: "default" },
    });
  }

  return flashSale;
};

const getFlashSale = async () => {
  await ensureFlashSale();

  const flashSale = await prisma.flashSale.findUniqueOrThrow({
    where: { id: "default" },
    include: {
      products: {
        orderBy: { order: "asc" },
        include: { product: { select: adminProductSelect } },
      },
    },
  });

  return {
    isActive: flashSale.isActive,
    startTime: flashSale.startTime,
    endTime: flashSale.endTime,
    products: flashSale.products.map((entry) => ({
      productId: entry.productId,
      order: entry.order,
      product: entry.product,
    })),
  };
};

const replaceFlashSale = async (payload: {
  isActive: boolean;
  startTime: string | null;
  endTime: string | null;
  productIds: string[];
}) => {
  const startTime = payload.startTime ? new Date(payload.startTime) : null;
  const endTime = payload.endTime ? new Date(payload.endTime) : null;

  await prisma.$transaction([
    prisma.flashSale.upsert({
      where: { id: "default" },
      update: {
        isActive: payload.isActive,
        startTime,
        endTime,
      },
      create: {
        id: "default",
        isActive: payload.isActive,
        startTime,
        endTime,
      },
    }),
    prisma.flashSaleProduct.deleteMany({
      where: { flashSaleId: "default" },
    }),
    prisma.flashSaleProduct.createMany({
      data: payload.productIds.map((productId, index) => ({
        flashSaleId: "default",
        productId,
        order: index,
      })),
    }),
  ]);

  return getFlashSale();
};

const getPublicFlashSale = async () => {
  const flashSale = await prisma.flashSale.findUnique({
    where: { id: "default" },
  });

  const startTime = flashSale?.startTime ?? null;
  const endTime = flashSale?.endTime ?? null;

  // isVisible is derived from server time, never trusted from the client,
  // so the countdown can't be spoofed by a stale/altered clock on the frontend.
  const now = new Date();
  const isVisible = Boolean(
    flashSale?.isActive &&
      startTime &&
      endTime &&
      now >= startTime &&
      now <= endTime,
  );

  if (!isVisible) {
    return {
      isVisible: false,
      startTime,
      endTime,
      products: [],
    };
  }

  const entries = await prisma.flashSaleProduct.findMany({
    where: { flashSaleId: "default" },
    orderBy: { order: "asc" },
  });

  const productIds = entries.map((entry) => entry.productId);

  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds }, status: ProductStatus.ACTIVE },
        include: productInclude,
      })
    : [];

  const productMap = new Map(products.map((product) => [product.id, product]));
  const orderedProducts = productIds
    .map((id) => productMap.get(id))
    .filter((product): product is (typeof products)[number] => Boolean(product));

  return {
    isVisible: true,
    startTime,
    endTime,
    products: orderedProducts,
  };
};

// Public view shows prices and stock: short TTL, cleared on product changes
export const FlashSaleService = {
  getFlashSale,
  replaceFlashSale: invalidates(["flash-sale"], replaceFlashSale),
  getPublicFlashSale: cached("flash-sale", 30 * 1000, getPublicFlashSale),
};
