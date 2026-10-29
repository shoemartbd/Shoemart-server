import { prisma } from "../../lib/prisma";
import { OrderStatus } from "../../../generated/prisma/enums";

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

type CustomerSegment = "NEW" | "REGULAR" | "LOYAL";

type CustomerBucket = {
  phone: string;
  fullName: string | null;
  district: string | null;
  orderIds: Set<string>;
  totalRevenue: number;
  totalQuantity: number;
  firstOrderDate: Date;
  lastOrderDate: Date;
};

const resolveSegment = (totalOrders: number): CustomerSegment => {
  if (totalOrders >= 5) return "LOYAL";
  if (totalOrders >= 2) return "REGULAR";
  return "NEW";
};

/**
 * Customer segmentation (New / Regular / Loyal) for the selected date range,
 * grouped by phone number since phone is the only identifier consistent
 * across online, POS, and landing-page order channels.
 */
const getCustomerSegmentOverview = async (range: DateRange) => {
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
      order: {
        select: {
          id: true,
          phone: true,
          fullName: true,
          district: true,
          orderType: true,
          createdAt: true,
        },
      },
    },
  });

  const customerMap = new Map<string, CustomerBucket>();
  const unidentifiedOrderIds = new Set<string>();

  for (const item of items) {
    const netQuantity = item.quantity - item.returnedQuantity;
    if (netQuantity <= 0) continue;

    const revenue = netQuantity * item.price;
    const rawPhone = item.order.phone?.trim();

    // POS walk-in orders default phone to the literal "N/A" — these can't be
    // attributed to an identifiable customer, so exclude them from segmentation.
    if (!rawPhone || rawPhone.toLowerCase() === "n/a") {
      unidentifiedOrderIds.add(item.order.id);
      continue;
    }

    const bucket = customerMap.get(rawPhone) || {
      phone: rawPhone,
      fullName: item.order.fullName,
      district: item.order.district,
      orderIds: new Set<string>(),
      totalRevenue: 0,
      totalQuantity: 0,
      firstOrderDate: item.order.createdAt,
      lastOrderDate: item.order.createdAt,
    };

    bucket.totalRevenue += revenue;
    bucket.totalQuantity += netQuantity;
    bucket.orderIds.add(item.order.id);

    if (item.order.createdAt < bucket.firstOrderDate) {
      bucket.firstOrderDate = item.order.createdAt;
    }
    if (item.order.createdAt >= bucket.lastOrderDate) {
      bucket.lastOrderDate = item.order.createdAt;
      bucket.fullName = item.order.fullName;
      bucket.district = item.order.district;
    }

    customerMap.set(rawPhone, bucket);
  }

  const rankedCustomers = Array.from(customerMap.values())
    .map((bucket) => ({
      phone: bucket.phone,
      fullName: bucket.fullName,
      district: bucket.district,
      totalOrders: bucket.orderIds.size,
      totalRevenue: bucket.totalRevenue,
      totalQuantity: bucket.totalQuantity,
      firstOrderDate: bucket.firstOrderDate,
      lastOrderDate: bucket.lastOrderDate,
      segment: resolveSegment(bucket.orderIds.size),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Top-10% by revenue are flagged as high spenders, independent of segment —
  // a brand-new customer with one huge order can still qualify.
  const highSpenderIdx = Math.max(0, Math.ceil(rankedCustomers.length * 0.1) - 1);
  const highSpenderThreshold =
    rankedCustomers.length > 0 ? rankedCustomers[highSpenderIdx].totalRevenue : 0;

  const customers = rankedCustomers.map((customer) => ({
    ...customer,
    isHighSpender: customer.totalRevenue >= highSpenderThreshold && highSpenderThreshold > 0,
  }));

  const segmentBreakdown = (["NEW", "REGULAR", "LOYAL"] as CustomerSegment[]).map((segment) => {
    const segmentCustomers = customers.filter((customer) => customer.segment === segment);
    return {
      segment,
      count: segmentCustomers.length,
      totalRevenue: segmentCustomers.reduce((sum, customer) => sum + customer.totalRevenue, 0),
    };
  });

  const summary = {
    totalCustomers: customers.length,
    newCustomers: customers.filter((customer) => customer.segment === "NEW").length,
    regularCustomers: customers.filter((customer) => customer.segment === "REGULAR").length,
    loyalCustomers: customers.filter((customer) => customer.segment === "LOYAL").length,
    highSpenderCount: customers.filter((customer) => customer.isHighSpender).length,
    totalRevenue: customers.reduce((sum, customer) => sum + customer.totalRevenue, 0),
    unidentifiedOrders: unidentifiedOrderIds.size,
  };

  return { summary, segmentBreakdown, highSpenderThreshold, customers };
};

export const CustomerSegmentReportService = {
  getCustomerSegmentOverview,
};
