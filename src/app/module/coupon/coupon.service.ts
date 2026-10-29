import status from "http-status";
import { prisma } from "../../lib/prisma";
import { IQueryParams } from "../../interfaces/query.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import AppError from "../../errorHelpers/AppError";
import { ShopService } from "../shop/shop.service";

const createCoupon = async (payload: {
  code: string;
  discountType: "FLAT" | "PERCENTAGE";
  discountAmount: number;
  maxDiscountAmount?: number;
  minPurchaseAmount: number;
  startDate: string;
  endDate: string;
  productIds: string[];
}) => {
  const { productIds, ...couponData } = payload;

  // Validate end date > start date
  if (new Date(couponData.endDate) <= new Date(couponData.startDate)) {
    throw new AppError(status.BAD_REQUEST, "End date must be after start date");
  }

  // Check coupon code uniqueness
  const existing = await prisma.coupon.findUnique({ where: { code: couponData.code } });
  if (existing) {
    throw new AppError(status.CONFLICT, "Coupon code already exists");
  }

  // Verify all products exist
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });

  if (products.length !== productIds.length) {
    throw new AppError(status.BAD_REQUEST, "Some products do not exist");
  }

  const shopId = await ShopService.getDefaultShopId();

  const coupon = await prisma.coupon.create({
    data: {
      ...couponData,
      shopId,
      startDate: new Date(couponData.startDate),
      endDate: new Date(couponData.endDate),
      products: {
        create: productIds.map((productId) => ({ productId })),
      },
    },
    include: {
      products: {
        include: {
          product: {
            select: { id: true, name: true, images: true },
          },
        },
      },
    },
  });

  return coupon;
};

const getAllCoupons = async (queryParams: IQueryParams) => {
  const result = await new QueryBuilder(prisma.coupon, queryParams, {
    searchableFields: ["code"],
    filterableFields: ["isActive", "discountType"],
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      products: {
        include: {
          product: {
            select: { id: true, name: true, images: true },
          },
        },
      },
    })
    .execute();

  return result;
};

const getCouponById = async (id: string) => {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: {
      products: {
        include: {
          product: {
            select: { id: true, name: true, images: true },
          },
        },
      },
    },
  });

  if (!coupon) {
    throw new AppError(status.NOT_FOUND, "Coupon not found");
  }

  return coupon;
};

const toggleCouponStatus = async (id: string) => {
  const coupon = await prisma.coupon.findUnique({ where: { id } });

  if (!coupon) {
    throw new AppError(status.NOT_FOUND, "Coupon not found");
  }

  const updated = await prisma.coupon.update({
    where: { id },
    data: { isActive: !coupon.isActive },
  });

  return updated;
};

const deleteCoupon = async (id: string) => {
  const coupon = await prisma.coupon.findUnique({ where: { id } });

  if (!coupon) {
    throw new AppError(status.NOT_FOUND, "Coupon not found");
  }

  await prisma.coupon.delete({ where: { id } });
  return { message: "Coupon deleted successfully" };
};

const validateCoupon = async (payload: {
  code: string;
  items: { productId: string; price: number; quantity: number }[];
}) => {
  const { code, items } = payload;

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      products: true,
    },
  });

  if (!coupon) {
    throw new AppError(status.NOT_FOUND, "Invalid coupon code");
  }

  if (!coupon.isActive) {
    throw new AppError(status.BAD_REQUEST, "This coupon is inactive");
  }

  const now = new Date();
  if (now < new Date(coupon.startDate) || now > new Date(coupon.endDate)) {
    throw new AppError(status.BAD_REQUEST, "This coupon has expired");
  }

  // Get matching products
  const couponProductIds = coupon.products.map((cp) => cp.productId);
  const eligibleItems = items.filter((item) =>
    couponProductIds.includes(item.productId)
  );

  if (eligibleItems.length === 0) {
    throw new AppError(
      status.BAD_REQUEST,
      "This coupon is not applicable to the products in your cart"
    );
  }

  const eligibleSubtotal = eligibleItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  if (eligibleSubtotal < coupon.minPurchaseAmount) {
    throw new AppError(
      status.BAD_REQUEST,
      `Minimum purchase amount of ৳${coupon.minPurchaseAmount} not met for this coupon`
    );
  }

  let discount = 0;
  if (coupon.discountType === "FLAT") {
    discount = Math.min(coupon.discountAmount, eligibleSubtotal);
  } else if (coupon.discountType === "PERCENTAGE") {
    discount = eligibleSubtotal * (coupon.discountAmount / 100);
    if (coupon.maxDiscountAmount) {
      discount = Math.min(discount, coupon.maxDiscountAmount);
    }
  }

  return {
    couponId: coupon.id,
    code: coupon.code,
    discountAmount: parseFloat(discount.toFixed(2)),
    discountType: coupon.discountType,
  };
};

export const CouponService = {
  createCoupon,
  getAllCoupons,
  getCouponById,
  toggleCouponStatus,
  deleteCoupon,
  validateCoupon,
};
