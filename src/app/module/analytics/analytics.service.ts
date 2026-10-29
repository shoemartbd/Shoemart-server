import { prisma } from "../../lib/prisma";
import {
  OrderStatus,
  OrderType,
  ProductStatus,
  Role,
} from "../../../generated/prisma/enums";
import { LowStockService } from "../low-stock/lowStock.service";

// Cancelled orders never earned anything. Returns already lower an order's
// totalAmount when processed, so they need no separate subtraction.
const earning = { orderStatus: { not: OrderStatus.CANCELLED } };

// Day and month boundaries in Bangladesh time (UTC+6, no DST), whatever
// timezone the server runs in
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const dhakaMidnight = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month, day) - DHAKA_OFFSET_MS);

const getAdminAnalytics = async () => {
  const dhakaNow = new Date(Date.now() + DHAKA_OFFSET_MS);
  const year = dhakaNow.getUTCFullYear();
  const month = dhakaNow.getUTCMonth();
  const startOfToday = dhakaMidnight(year, month, dhakaNow.getUTCDate());
  const startOfMonth = dhakaMidnight(year, month, 1);

  const [
    totalUsers,
    totalProducts,
    totalOrders,
    orderStats,
    todayStats,
    monthStats,
    statusGroups,
    returnStats,
    returnedUnits,
    stock,
    recentOrders,
  ] = await Promise.all([
    prisma.user.count({ where: { role: Role.USER } }),
    prisma.product.count({ where: { status: { not: ProductStatus.DELETED } } }),
    prisma.order.count(),
    prisma.order.aggregate({ where: earning, _sum: { totalAmount: true } }),
    prisma.order.aggregate({
      where: { ...earning, createdAt: { gte: startOfToday } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: { ...earning, createdAt: { gte: startOfMonth } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.order.groupBy({ by: ["orderType", "orderStatus"], _count: true }),
    prisma.orderReturn.aggregate({ _sum: { refundAmount: true }, _count: true }),
    prisma.orderReturnItem.aggregate({ _sum: { quantity: true } }),
    LowStockService.getLowStockCounts(),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        orderNumber: true,
        orderType: true,
        fullName: true,
        phone: true,
        totalAmount: true,
        orderStatus: true,
        paymentStatus: true,
        createdAt: true,
      },
    }),
  ]);

  // Status counts per order type. POS sales are delivered on the spot, so the
  // dashboard tracks online and landing page orders separately.
  const countStatuses = (type: OrderType) =>
    Object.fromEntries(
      Object.values(OrderStatus).map((s) => [
        s,
        statusGroups.find((g) => g.orderType === type && g.orderStatus === s)
          ?._count ?? 0,
      ]),
    ) as Record<OrderStatus, number>;
  const orderStatus = {
    online: countStatuses(OrderType.ONLINE),
    landingPage: countStatuses(OrderType.LANDING_PAGE),
  };

  // Six month buckets, oldest first, empty months included. Summed in the
  // database rather than loading every order of the last six months.
  const revenueTrend = await Promise.all(
    Array.from({ length: 6 }, async (_, i) => {
      const start = dhakaMidnight(year, month - 5 + i, 1);
      const end = dhakaMidnight(year, month - 4 + i, 1);
      const stats = await prisma.order.aggregate({
        where: { ...earning, createdAt: { gte: start, lt: end } },
        _sum: { totalAmount: true },
        _count: true,
      });
      const label = new Date(Date.UTC(year, month - 5 + i, 1));
      return {
        month: label.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
        year: label.getUTCFullYear(),
        revenue: stats._sum.totalAmount || 0,
        orders: stats._count,
      };
    }),
  );

  // Get product count by category
  const categoryDistribution = await prisma.category.findMany({
    select: {
      name: true,
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  return {
    summary: {
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue: orderStats._sum.totalAmount || 0,
    },
    today: {
      orders: todayStats._count,
      revenue: todayStats._sum.totalAmount || 0,
    },
    thisMonth: {
      orders: monthStats._count,
      revenue: monthStats._sum.totalAmount || 0,
    },
    orderStatus,
    returns: {
      count: returnStats._count,
      units: returnedUnits._sum.quantity || 0,
      refundAmount: returnStats._sum.refundAmount || 0,
    },
    stock,
    recentOrders,
    revenueTrend,
    categoryDistribution,
  };
};

const getUserAnalytics = async (userId: string) => {
  const [totalOrders, orderStats, recentOrders] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.order.aggregate({
      where: { userId },
      _sum: {
        totalAmount: true,
      },
    }),
    prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                images: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    summary: {
      totalOrders,
      totalSpending: orderStats._sum.totalAmount || 0,
    },
    recentOrders,
  };
};

export const AnalyticsService = {
  getAdminAnalytics,
  getUserAnalytics,
};
