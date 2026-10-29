import status from "http-status";
import { prisma } from "../../lib/prisma";
import { IQueryParams } from "../../interfaces/query.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import AppError from "../../errorHelpers/AppError";
import { generateUniqueSlug } from "../../utils/generateSlug";
import { OrderService } from "../order/order.service";
import { OrderType } from "../../../generated/prisma/enums";
import { ShopService } from "../shop/shop.service";

const createLandingPage = async (payload: {
  productId: string;
  campaignTitle: string;
  bannerImage?: string;
  galleryImages?: string[];
  reviewImages?: string[];
  [key: string]: unknown;
}) => {
  const product = await prisma.product.findUnique({
    where: { id: payload.productId },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  const shopId = await ShopService.getDefaultShopId();

  const slug = await generateUniqueSlug(prisma, payload.campaignTitle, "landingPage");

  const landingPage = await prisma.landingPage.create({
    data: {
      ...payload,
      slug,
      shopId,
    },
  });

  return landingPage;
};

const getMyLandingPages = async (queryParams: IQueryParams) => {
  const query = new QueryBuilder(prisma.landingPage, queryParams, {
    searchableFields: ["campaignTitle"],
    filterableFields: ["isActive"],
  })
    .include({ product: { select: { id: true, name: true, images: true, slug: true } } })
    .search()
    .filter()
    .sort()
    .paginate();

  return await query.execute();
};

const getLandingPageById = async (id: string) => {
  const landingPage = await prisma.landingPage.findUnique({
    where: { id },
    include: { product: true },
  });

  if (!landingPage) {
    throw new AppError(status.NOT_FOUND, "Landing page not found");
  }

  return landingPage;
};

const getLandingPageBySlug = async (slug: string) => {
  const landingPage = await prisma.landingPage.findUnique({
    where: { slug },
    include: {
      product: {
        include: {
          variants: true,
          shop: { select: { id: true, name: true, logo: true } },
        },
      },
    },
  });

  if (!landingPage || !landingPage.isActive) {
    throw new AppError(status.NOT_FOUND, "Landing page not found");
  }

  // Best-effort view counter — failure here should never break the page render
  prisma.landingPage
    .update({ where: { id: landingPage.id }, data: { views: { increment: 1 } } })
    .catch(() => undefined);

  return landingPage;
};

const updateLandingPage = async (
  id: string,
  payload: {
    campaignTitle?: string;
    [key: string]: unknown;
  },
) => {
  const existing = await prisma.landingPage.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(status.NOT_FOUND, "Landing page not found");
  }

  if (payload.productId) {
    const product = await prisma.product.findUnique({
      where: { id: payload.productId as string },
    });
    if (!product) {
      throw new AppError(status.NOT_FOUND, "Product not found");
    }
  }

  let slug: string | undefined;
  if (payload.campaignTitle && payload.campaignTitle !== existing.campaignTitle) {
    slug = await generateUniqueSlug(prisma, payload.campaignTitle, "landingPage", id);
  }

  const updated = await prisma.landingPage.update({
    where: { id },
    data: { ...payload, ...(slug && { slug }) },
    include: { product: true },
  });

  return updated;
};

const deleteLandingPage = async (id: string) => {
  const existing = await prisma.landingPage.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(status.NOT_FOUND, "Landing page not found");
  }

  await prisma.landingPage.delete({ where: { id } });

  return { message: "Landing page deleted successfully" };
};

const createGuestOrder = async (
  slug: string,
  payload: {
    fullName: string;
    companyName?: string;
    phone: string;
    address: string;
    district: string;
    productVariantId?: string | null;
    quantity: number;
    shippingFee?: number;
    checkoutSessionToken?: string;
    notes?: string;
    paymentMethod?: "COD" | "BKASH";
  },
  userId: string | null = null,
) => {
  const landingPage = await prisma.landingPage.findUnique({ where: { slug } });

  if (!landingPage || !landingPage.isActive) {
    throw new AppError(status.NOT_FOUND, "Landing page not found");
  }

  if (!userId) await OrderService.assertGuestCheckoutEnabled();

  const order = await OrderService.createOrder(userId, {
    fullName: payload.fullName,
    companyName: payload.companyName,
    phone: payload.phone,
    address: payload.address,
    district: payload.district,
    shippingFee: payload.shippingFee,
    orderType: OrderType.LANDING_PAGE,
    checkoutSessionToken: payload.checkoutSessionToken,
    notes: payload.notes || undefined,
    paymentMethod: payload.paymentMethod ?? "COD",
    items: [
      {
        productId: landingPage.productId,
        productVariantId: payload.productVariantId || undefined,
        quantity: payload.quantity,
      },
    ],
  });

  return order;
};

export const LandingPageService = {
  createLandingPage,
  getMyLandingPages,
  getLandingPageById,
  getLandingPageBySlug,
  updateLandingPage,
  deleteLandingPage,
  createGuestOrder,
};
