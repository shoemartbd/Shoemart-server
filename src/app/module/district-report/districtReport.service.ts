import { prisma } from "../../lib/prisma";
import { OrderStatus, OrderType } from "../../../generated/prisma/enums";

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

type ProductBucket = { productId: string; name: string; quantity: number; revenue: number };

type DistrictBucket = {
  district: string;
  totalRevenue: number;
  totalQuantity: number;
  orderIds: Set<string>;
  products: Map<string, ProductBucket>;
};

type OrderItemSummary = { productName: string; quantity: number };

type OrderBucket = {
  id: string;
  orderNumber: string | null;
  fullName: string | null;
  phone: string | null;
  district: string | null;
  orderType: OrderType;
  createdAt: Date;
  totalAmount: number;
  items: OrderItemSummary[];
};

/**
 * District-wise sales breakdown for the selected date range: which district
 * has the most orders/revenue, top-selling products overall and per
 * district, and a detailed per-order table (with phone numbers) for
 * contacting customers in a given district.
 */
const getDistrictReportOverview = async (range: DateRange) => {
  const dateFilter = buildDateFilter(range);

  const items = await prisma.orderItem.findMany({
    where: {
      status: OrderStatus.DELIVERED,
      ...(dateFilter && { order: { createdAt: dateFilter } }),
    },
    select: {
      quantity: true,
      returnedQuantity: true,
      price: true,
      productId: true,
      product: { select: { name: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          fullName: true,
          phone: true,
          district: true,
          orderType: true,
          createdAt: true,
        },
      },
    },
  });

  const districtMap = new Map<string, DistrictBucket>();
  const productMap = new Map<string, ProductBucket>();
  const orderMap = new Map<string, OrderBucket>();

  for (const item of items) {
    const netQuantity = item.quantity - item.returnedQuantity;
    // Fully returned items never contributed real sales — exclude them.
    if (netQuantity <= 0) continue;

    const revenue = netQuantity * item.price;
    const district = item.order.district?.trim() || "Unknown";

    const districtBucket = districtMap.get(district) || {
      district,
      totalRevenue: 0,
      totalQuantity: 0,
      orderIds: new Set<string>(),
      products: new Map<string, ProductBucket>(),
    };
    districtBucket.totalRevenue += revenue;
    districtBucket.totalQuantity += netQuantity;
    districtBucket.orderIds.add(item.order.id);

    const districtProductBucket = districtBucket.products.get(item.productId) || {
      productId: item.productId,
      name: item.product.name,
      quantity: 0,
      revenue: 0,
    };
    districtProductBucket.quantity += netQuantity;
    districtProductBucket.revenue += revenue;
    districtBucket.products.set(item.productId, districtProductBucket);
    districtMap.set(district, districtBucket);

    const productBucket = productMap.get(item.productId) || {
      productId: item.productId,
      name: item.product.name,
      quantity: 0,
      revenue: 0,
    };
    productBucket.quantity += netQuantity;
    productBucket.revenue += revenue;
    productMap.set(item.productId, productBucket);

    const orderBucket = orderMap.get(item.order.id) || {
      id: item.order.id,
      orderNumber: item.order.orderNumber,
      fullName: item.order.fullName,
      phone: item.order.phone,
      district: item.order.district,
      orderType: item.order.orderType,
      createdAt: item.order.createdAt,
      totalAmount: 0,
      items: [],
    };
    orderBucket.totalAmount += revenue;
    orderBucket.items.push({ productName: item.product.name, quantity: netQuantity });
    orderMap.set(item.order.id, orderBucket);
  }

  const districts = Array.from(districtMap.values())
    .map((bucket) => ({
      district: bucket.district,
      totalOrders: bucket.orderIds.size,
      totalRevenue: bucket.totalRevenue,
      totalQuantity: bucket.totalQuantity,
      topProducts: Array.from(bucket.products.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const orders = Array.from(orderMap.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const summary = {
    totalOrders: orderMap.size,
    totalRevenue: districts.reduce((sum, d) => sum + d.totalRevenue, 0),
    totalQuantity: districts.reduce((sum, d) => sum + d.totalQuantity, 0),
    totalDistricts: districts.length,
  };

  return { summary, districts, topProducts, orders };
};

export const DistrictReportService = {
  getDistrictReportOverview,
};
