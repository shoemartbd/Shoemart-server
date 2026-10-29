import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";

// Single-vendor store: exactly one Shop row is expected to exist (see seed.ts).
// Other modules resolve this row instead of scoping by vendor/seller.
const getDefaultShop = async () => {
  const shop = await prisma.shop.findFirst();

  if (!shop) {
    throw new AppError(status.NOT_FOUND, "Store is not set up yet");
  }

  return shop;
};

const getDefaultShopId = async () => {
  const shop = await getDefaultShop();
  return shop.id;
};

interface IUpdateStorePayload {
  name?: string;
  description?: string;
  logo?: string;
  banner?: string;
}

const updateStore = async (payload: IUpdateStorePayload) => {
  const shop = await getDefaultShop();

  const updatedShop = await prisma.shop.update({
    where: { id: shop.id },
    data: payload,
  });

  return updatedShop;
};

export const ShopService = {
  getDefaultShop,
  getDefaultShopId,
  updateStore,
};
