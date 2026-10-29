import { prisma } from "../../lib/prisma";
import { OrderStatus, OrderType } from "../../../generated/prisma/enums";
import { sumByPeriod } from "../../utils/periodSummary";

type DateRange = { startDate?: string; endDate?: string };

const buildDateFilter = (range: DateRange): { gte?: Date; lte?: Date } | undefined => {
  if (!range.startDate && !range.endDate) return undefined;

  const filter: { gte?: Date; lte?: Date } = {};
  if (range.startDate) filter.gte = new Date(range.startDate);
  if (range.endDate) {
    const end = new Date(range.endDate);
    end.setHours(23, 59, 59, 999);
    filter.lte = end;
  }
  return filter;
};

/**
 * Period-bucketed store-wide sales totals — a higher-level companion to the
 * Sales Report summary.
 */
const getPlatformSummary = async () => {
  const items = await prisma.orderItem.findMany({
    where: { status: OrderStatus.DELIVERED },
    select: {
      price: true,
      quantity: true,
      returnedQuantity: true,
      order: { select: { createdAt: true } },
    },
  });

  const gmv = sumByPeriod(
    items.map((item) => ({
      // Returned units were refunded — they never count toward GMV.
      amount: item.price * (item.quantity - item.returnedQuantity),
      date: item.order.createdAt,
    })),
  );

  return { gmv };
};

/**
 * Store-wide breakdown for the selected date range: totals, channel mix,
 * order-status funnel, and top-performing products.
 */
const getPlatformOverview = async (range: DateRange) => {
  const dateFilter = buildDateFilter(range);

  const items = await prisma.orderItem.findMany({
    where: {
      status: OrderStatus.DELIVERED,
      ...(dateFilter && { order: { createdAt: dateFilter } }),
    },
    select: {
      orderId: true,
      price: true,
      quantity: true,
      returnedQuantity: true,
      productId: true,
      product: { select: { name: true } },
      order: { select: { orderType: true } },
    },
  });

  let gmv = 0;
  const orderIds = new Set<string>();

  const byOrderTypeMap = new Map<OrderType, { gmv: number; count: number }>();
  const productMap = new Map<
    string,
    { productId: string; name: string; quantity: number; revenue: number }
  >();

  for (const item of items) {
    const netQuantity = item.quantity - item.returnedQuantity;
    const lineTotal = item.price * netQuantity;
    gmv += lineTotal;
    orderIds.add(item.orderId);

    const typeBucket = byOrderTypeMap.get(item.order.orderType) || { gmv: 0, count: 0 };
    typeBucket.gmv += lineTotal;
    typeBucket.count += 1;
    byOrderTypeMap.set(item.order.orderType, typeBucket);

    const productBucket = productMap.get(item.productId) || {
      productId: item.productId,
      name: item.product.name,
      quantity: 0,
      revenue: 0,
    };
    productBucket.quantity += netQuantity;
    productBucket.revenue += lineTotal;
    productMap.set(item.productId, productBucket);
  }

  const orderStatusGroups = await prisma.order.groupBy({
    by: ["orderStatus"],
    _count: { id: true },
    where: dateFilter ? { createdAt: dateFilter } : undefined,
  });

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  return {
    totals: {
      gmv,
      orderCount: orderIds.size,
      avgOrderValue: orderIds.size > 0 ? gmv / orderIds.size : 0,
    },
    byOrderType: Array.from(byOrderTypeMap.entries()).map(([orderType, v]) => ({
      orderType,
      ...v,
    })),
    byOrderStatus: orderStatusGroups.map((g) => ({
      orderStatus: g.orderStatus,
      count: g._count.id,
    })),
    topProducts,
  };
};

/**
 * Detailed, exportable order-item list for the selected filters — the
 * store-wide companion to the Sales Report item table.
 */
const getPlatformItems = async (range: DateRange & { orderType?: string }) => {
  const dateFilter = buildDateFilter(range);

  const orderWhere: { createdAt?: { gte?: Date; lte?: Date }; orderType?: OrderType } = {};
  if (dateFilter) orderWhere.createdAt = dateFilter;
  if (range.orderType && Object.values(OrderType).includes(range.orderType as OrderType)) {
    orderWhere.orderType = range.orderType as OrderType;
  }

  const items = await prisma.orderItem.findMany({
    where: {
      status: OrderStatus.DELIVERED,
      ...(Object.keys(orderWhere).length > 0 && { order: orderWhere }),
    },
    include: {
      product: { select: { id: true, name: true } },
      productVariant: { select: { id: true, combination: true } },
      order: { select: { orderNumber: true, orderType: true, createdAt: true } },
    },
    orderBy: { order: { createdAt: "desc" } },
  });

  let totalGmv = 0;
  let totalQuantity = 0;

  const result = items.map((item) => {
    const netQuantity = item.quantity - item.returnedQuantity;
    const lineTotal = item.price * netQuantity;
    totalGmv += lineTotal;
    totalQuantity += netQuantity;

    return {
      id: item.id,
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
    totals: { totalGmv, totalQuantity },
  };
};

export const PlatformReportService = {
  getPlatformSummary,
  getPlatformOverview,
  getPlatformItems,
};
