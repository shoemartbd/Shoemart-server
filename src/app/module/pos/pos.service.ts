import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { OrderStatus, PaymentStatus, OrderType, ProductStatus } from "../../../generated/prisma/enums";
import { IQueryParams } from "../../interfaces/query.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { generateOrderNumber } from "../../utils/generateOrderNumber";

const COMMISSION_RATE = 0.1; // 10% commission

const getShopProducts = async (shopId: string, queryParams: IQueryParams) => {
  const productQuery = new QueryBuilder(prisma.product, queryParams, {
    searchableFields: ["name", "slug"], // Can add barcode if added to schema
    filterableFields: ["status"],
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      variants: true,
      category: true,
    })
    .where({
      shopId,
      status: ProductStatus.ACTIVE,
    });

  return await productQuery.execute();
};

const getPosCart = async (shopId: string) => {
  return await prisma.posCartItem.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
  });
};

const addToPosCart = async (
  shopId: string,
  payload: {
    productId: string;
    productVariantId?: string | null;
    productName: string;
    price: number;
    quantity: number;
    combination?: string | null;
    productImage?: string | null;
  }
) => {
  // Check if exactly this item already exists
  const existingItem = await prisma.posCartItem.findFirst({
    where: {
      shopId,
      productId: payload.productId,
      productVariantId: payload.productVariantId || null,
    },
  });

  if (existingItem) {
    return await prisma.posCartItem.update({
      where: { id: existingItem.id },
      data: { quantity: existingItem.quantity + payload.quantity },
    });
  }

  return await prisma.posCartItem.create({
    data: {
      shopId,
      productId: payload.productId,
      productVariantId: payload.productVariantId || null,
      productName: payload.productName,
      price: payload.price,
      quantity: payload.quantity,
      combination: payload.combination,
      productImage: payload.productImage,
    },
  });
};

const updatePosCartItem = async (shopId: string, id: string, quantity: number) => {
  const item = await prisma.posCartItem.findUnique({ where: { id } });
  if (!item || item.shopId !== shopId) {
    throw new AppError(status.NOT_FOUND, "Cart item not found");
  }

  return await prisma.posCartItem.update({
    where: { id },
    data: { quantity },
  });
};

const deletePosCartItem = async (shopId: string, id: string) => {
  const item = await prisma.posCartItem.findUnique({ where: { id } });
  if (!item || item.shopId !== shopId) {
    throw new AppError(status.NOT_FOUND, "Cart item not found");
  }

  return await prisma.posCartItem.delete({
    where: { id },
  });
};

const clearPosCart = async (shopId: string) => {
  return await prisma.posCartItem.deleteMany({
    where: { shopId },
  });
};

const createPosOrder = async (
  shopId: string,
  payload: {
    subtotal: number;
    discount: number;
    tax: number;
    shippingCharge: number;
    total: number;
    coupon?: string | null;
    customer?: {
      name?: string | null;
      companyName?: string | null;
      phone?: string | null;
      address?: string | null;
      district?: string | null;
      note?: string | null;
    };
    payment: {
      method: string;
      amount: number;
      change: number;
    };
  }
) => {
  // 1. Get cart items
  const cartItems = await prisma.posCartItem.findMany({
    where: { shopId },
    include: {
      product: { include: { variants: true } },
    },
  });

  if (cartItems.length === 0) {
    throw new AppError(status.BAD_REQUEST, "POS cart is empty");
  }

  // 2. Perform Transaction
  const order = await prisma.$transaction(async (tx) => {
    // Check stock first
    for (const item of cartItems) {
      if (item.productVariantId) {
        const variant = item.product.variants.find(v => v.id === item.productVariantId);
        if (!variant || variant.quantity < item.quantity) {
          throw new AppError(
            status.BAD_REQUEST,
            `Not enough stock for variant ${item.combination} of ${item.productName}`
          );
        }
      } else {
        if (item.product.stock < item.quantity) {
          throw new AppError(
            status.BAD_REQUEST,
            `Not enough stock for product ${item.productName}`
          );
        }
      }
    }

    // Create Order
    const newOrder = await tx.order.create({
      data: {
        orderType: OrderType.POS,
        shopId: shopId,
        // POS sales are walk-in and not tied to a registered customer account.
        userId: null,
        totalAmount: payload.total,
        discountAmount: payload.discount,
        shippingFee: payload.shippingCharge,
        vatAmount: payload.tax,
        paymentStatus: PaymentStatus.PAID,
        orderStatus: OrderStatus.DELIVERED,
        paymentMethod: payload.payment.method,
        
        fullName: payload.customer?.name || "Walk-in Customer",
        companyName: payload.customer?.companyName?.trim() || null,
        phone: payload.customer?.phone || "N/A",
        address: payload.customer?.address || "N/A",
        district: payload.customer?.district || "N/A",
        notes: payload.customer?.note || null,
      },
    });

    const orderWithNumber = await tx.order.update({
      where: { id: newOrder.id },
      data: { orderNumber: generateOrderNumber(newOrder.orderType, newOrder.orderSeq) },
    });

    // Create Order Items and update stock
    for (const item of cartItems) {
      const itemTotal = item.price * item.quantity;
      const itemCommission = itemTotal * COMMISSION_RATE;
      const vendorEarning = itemTotal - itemCommission;

      const variant = item.productVariantId
        ? item.product.variants.find((v) => v.id === item.productVariantId)
        : null;

      await tx.orderItem.create({
        data: {
          orderId: newOrder.id,
          productId: item.productId,
          productVariantId: item.productVariantId,
          shopId: shopId,
          quantity: item.quantity,
          price: item.price,
          costPrice: variant?.purchasePrice ?? item.product.purchasePrice,
          platformEarning: itemCommission,
          vendorEarning: vendorEarning,
          status: OrderStatus.DELIVERED,
        },
      });

      // Decrement stock
      if (item.productVariantId) {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { quantity: { decrement: item.quantity } },
        });
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
    }

    // Clear POS cart
    await tx.posCartItem.deleteMany({
      where: { shopId },
    });

    return orderWithNumber;
  });

  return order;
};

const getPosOrders = async (shopId: string, queryParams: IQueryParams) => {
  const orderQuery = new QueryBuilder(prisma.order, queryParams, {
    searchableFields: ["orderNumber", "phone", "fullName", "companyName"],
    filterableFields: ["paymentMethod"],
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      items: {
        include: {
          product: true,
          productVariant: true,
        },
      },
    })
    .where({
      shopId,
      orderType: OrderType.POS,
    });

  return await orderQuery.execute();
};

export const PosService = {
  getShopProducts,
  getPosCart,
  addToPosCart,
  updatePosCartItem,
  deletePosCartItem,
  clearPosCart,
  createPosOrder,
  getPosOrders,
};
