import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { NotificationService } from "../notification/notification.service";
import { ShopService } from "../shop/shop.service";

const processOrderReturn = async (
  payload: {
    orderId: string;
    items: { orderItemId: string; quantity: number }[];
  },
  adminId: string,
) => {
  const shopId = await ShopService.getDefaultShopId();

  const order = await prisma.order.findUnique({
    where: { id: payload.orderId },
    include: { items: true },
  });
  if (!order) throw new AppError(status.NOT_FOUND, "Order not found");

  const requestedMap = new Map(payload.items.map((i) => [i.orderItemId, i.quantity]));
  const targetItems = order.items.filter((item) => requestedMap.has(item.id));

  if (targetItems.length !== requestedMap.size) {
    throw new AppError(status.BAD_REQUEST, "One or more order items were not found on this order");
  }

  for (const item of targetItems) {
    const requestedQty = requestedMap.get(item.id) as number;
    const remaining = item.quantity - item.returnedQuantity;
    if (requestedQty > remaining) {
      throw new AppError(
        status.BAD_REQUEST,
        `Return quantity for "${item.id}" exceeds the remaining returnable quantity (${remaining})`,
      );
    }
  }

  const orderReturn = await prisma.$transaction(async (tx) => {
    let refundAmount = 0;
    const returnItemsData: {
      orderItemId: string;
      productId: string;
      productVariantId: string | null;
      quantity: number;
      price: number;
      subtotal: number;
    }[] = [];

    for (const item of targetItems) {
      const requestedQty = requestedMap.get(item.id) as number;
      const newReturnedQuantity = item.returnedQuantity + requestedQty;
      const remainingQuantity = item.quantity - newReturnedQuantity;
      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          returnedQuantity: newReturnedQuantity,
        },
      });

      // Restock the returned quantity
      if (item.productVariantId) {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { quantity: { increment: requestedQty } },
        });
      }
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: requestedQty } },
      });

      const subtotal = item.price * requestedQty;
      refundAmount += subtotal;

      returnItemsData.push({
        orderItemId: item.id,
        productId: item.productId,
        productVariantId: item.productVariantId,
        quantity: requestedQty,
        price: item.price,
        subtotal,
      });
    }

    // Recompute order totals from ALL items on the order (not just the ones just returned)
    const allItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
    const itemsRemainingSubtotal = allItems.reduce(
      (sum, i) => sum + i.price * (i.quantity - i.returnedQuantity),
      0,
    );

    // Shipping/VAT/discount are order-level and untouched by a return — only
    // the items subtotal shrinks.
    const newTotalAmount = Math.max(
      0,
      itemsRemainingSubtotal + order.shippingFee + order.vatAmount - order.discountAmount,
    );

    await tx.order.update({
      where: { id: order.id },
      data: { totalAmount: newTotalAmount },
    });

    return tx.orderReturn.create({
      data: {
        orderId: order.id,
        shopId,
        refundAmount,
        shippingFee: order.shippingFee,
        discountAmount: order.discountAmount,
        newTotalAmount,
        processedByAdminId: adminId,
        items: {
          create: returnItemsData,
        },
      },
      include: {
        items: {
          include: { product: true, productVariant: true },
        },
      },
    });
  });

  await NotificationService.notifyOrderReturnProcessed(order, orderReturn.refundAmount);

  return orderReturn;
};

const getAllOrderReturns = async (queryParams: IQueryParams) => {
  const orderReturnQuery = new QueryBuilder(prisma.orderReturn, queryParams, {
    searchableFields: ["order.orderNumber", "order.fullName", "order.phone"],
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      order: {
        select: {
          id: true,
          orderNumber: true,
          fullName: true,
          phone: true,
          district: true,
        },
      },
      items: {
        include: { product: true, productVariant: true },
      },
    });

  return await orderReturnQuery.execute();
};

const getReturnsByOrderId = async (orderId: string) => {
  return await prisma.orderReturn.findMany({
    where: { orderId },
    include: {
      items: {
        include: { product: true, productVariant: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const OrderReturnService = {
  processOrderReturn,
  getAllOrderReturns,
  getReturnsByOrderId,
};
