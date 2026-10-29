import { prisma } from "../../lib/prisma";
import { OrderStatus } from "../../../generated/prisma/enums";
import { sumByPeriod } from "../../utils/periodSummary";
import { ShopService } from "../shop/shop.service";

const getSalesSummary = async () => {
  const shopId = await ShopService.getDefaultShopId();

  const deliveredItems = await prisma.orderItem.findMany({
    where: { shopId, status: OrderStatus.DELIVERED },
    select: {
      price: true,
      quantity: true,
      returnedQuantity: true,
      order: { select: { createdAt: true } },
    },
  });

  return sumByPeriod(
    deliveredItems.map((item) => ({
      // Returned units were refunded — they never count as sales.
      amount: item.price * (item.quantity - item.returnedQuantity),
      date: item.order.createdAt,
    })),
  );
};

const getSalesReportItems = async (range: { startDate?: string; endDate?: string }) => {
  const shopId = await ShopService.getDefaultShopId();

  let dateFilter: { gte?: Date; lte?: Date } | undefined;
  if (range.startDate || range.endDate) {
    dateFilter = {};
    if (range.startDate) dateFilter.gte = new Date(range.startDate);
    if (range.endDate) {
      const end = new Date(range.endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
  }

  const items = await prisma.orderItem.findMany({
    where: {
      shopId,
      status: OrderStatus.DELIVERED,
      ...(dateFilter && { order: { createdAt: dateFilter } }),
    },
    include: {
      product: { select: { name: true } },
      productVariant: { select: { combination: true } },
      order: { select: { orderNumber: true, orderType: true, createdAt: true } },
    },
    orderBy: { order: { createdAt: "desc" } },
  });

  const productMap = new Map<string, { name: string; quantity: number; total: number }>();
  let totalSales = 0;
  let totalQuantity = 0;

  const result = items.map((item) => {
    const netQuantity = item.quantity - item.returnedQuantity;
    const lineTotal = item.price * netQuantity;

    totalSales += lineTotal;
    totalQuantity += netQuantity;

    const existing = productMap.get(item.productId);
    if (existing) {
      existing.quantity += netQuantity;
      existing.total += lineTotal;
    } else {
      productMap.set(item.productId, {
        name: item.product.name,
        quantity: netQuantity,
        total: lineTotal,
      });
    }

    return {
      id: item.id,
      productId: item.productId,
      product: item.product,
      productVariant: item.productVariant,
      price: item.price,
      quantity: item.quantity,
      returnedQuantity: item.returnedQuantity,
      lineTotal,
      order: item.order,
    };
  });

  return {
    items: result,
    productSummary: Array.from(productMap.values()),
    totals: {
      totalSales,
      totalQuantity,
    },
  };
};

export const SalesReportService = {
  getSalesSummary,
  getSalesReportItems,
};
