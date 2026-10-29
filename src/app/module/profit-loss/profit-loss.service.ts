import { prisma } from "../../lib/prisma";
import { OrderStatus } from "../../../generated/prisma/enums";
import { sumByPeriod, IPeriodSummary } from "../../utils/periodSummary";
import { ShopService } from "../shop/shop.service";

/**
 * Coupons in this app are shop-scoped (a coupon's eligible products always
 * belong to one shop), so an order's discountAmount can be safely prorated
 * using only this shop's own line items within that order — no other shop's
 * items in a mixed-cart order ever share in the same discount.
 *
 * Subtotals (and every per-item figure derived from them) are computed net of
 * returns — a returned unit was refunded, so it never counts as revenue.
 */
const buildOrderSubtotals = (
  items: { orderId: string; price: number; quantity: number; returnedQuantity: number }[],
) => {
  const subtotals = new Map<string, number>();
  for (const item of items) {
    const lineTotal = item.price * (item.quantity - item.returnedQuantity);
    subtotals.set(item.orderId, (subtotals.get(item.orderId) || 0) + lineTotal);
  }
  return subtotals;
};

const getProfitLossSummary = async () => {
  const shopId = await ShopService.getDefaultShopId();

  const items = await prisma.orderItem.findMany({
    where: { shopId, status: OrderStatus.DELIVERED },
    select: {
      orderId: true,
      price: true,
      quantity: true,
      returnedQuantity: true,
      costPrice: true,
      product: { select: { purchasePrice: true } },
      productVariant: { select: { purchasePrice: true } },
      order: { select: { discountAmount: true, shippingFee: true, createdAt: true } },
    },
  });

  const orderSubtotals = buildOrderSubtotals(items);

  const salesEntries: { amount: number; date: Date }[] = [];
  const costEntries: { amount: number; date: Date }[] = [];
  const discountEntries: { amount: number; date: Date }[] = [];
  const profitEntries: { amount: number; date: Date }[] = [];

  // Shipping is an order-level field — collect it once per order, not once per item.
  const shippingSeenOrderIds = new Set<string>();
  const shippingEntries: { amount: number; date: Date }[] = [];

  for (const item of items) {
    const netQuantity = item.quantity - item.returnedQuantity;
    const lineTotal = item.price * netQuantity;
    // Prefer the cost snapshot taken at order time; fall back to the current
    // product/variant purchasePrice for orders placed before this field existed.
    const unitCost =
      item.costPrice ?? item.productVariant?.purchasePrice ?? item.product.purchasePrice;
    const lineCost = unitCost * netQuantity;

    const orderSubtotal = orderSubtotals.get(item.orderId) || 0;
    const ratio = orderSubtotal > 0 ? lineTotal / orderSubtotal : 0;
    const lineDiscount = (item.order.discountAmount || 0) * ratio;

    const date = item.order.createdAt;
    salesEntries.push({ amount: lineTotal, date });
    costEntries.push({ amount: lineCost, date });
    discountEntries.push({ amount: lineDiscount, date });
    profitEntries.push({ amount: lineTotal - lineCost - lineDiscount, date });

    if (!shippingSeenOrderIds.has(item.orderId)) {
      shippingSeenOrderIds.add(item.orderId);
      shippingEntries.push({ amount: item.order.shippingFee || 0, date });
    }
  }

  const expenses = await prisma.expense.findMany({
    where: { shopId },
    select: { price: true, date: true },
  });
  const expenseEntries = expenses.map((expense) => ({ amount: expense.price, date: expense.date }));

  const sales = sumByPeriod(salesEntries);
  const cost = sumByPeriod(costEntries);
  const discount = sumByPeriod(discountEntries);
  const shipping = sumByPeriod(shippingEntries);
  const profit = sumByPeriod(profitEntries);
  const expense = sumByPeriod(expenseEntries);

  const periods = Object.keys(profit) as (keyof IPeriodSummary)[];
  const netProfit = periods.reduce((acc, period) => {
    acc[period] = profit[period] - expense[period];
    return acc;
  }, {} as IPeriodSummary);

  return { sales, cost, discount, shipping, profit, expense, netProfit };
};

const getProfitLossItems = async (
  range: { startDate?: string; endDate?: string },
) => {
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
      product: { select: { id: true, name: true, purchasePrice: true } },
      productVariant: { select: { id: true, combination: true, purchasePrice: true } },
      order: {
        select: {
          orderNumber: true,
          orderType: true,
          discountAmount: true,
          shippingFee: true,
          createdAt: true,
        },
      },
    },
    orderBy: { order: { createdAt: "desc" } },
  });

  const orderSubtotals = buildOrderSubtotals(items);

  let totalSales = 0;
  let totalCost = 0;
  let totalDiscount = 0;
  let totalProfit = 0;
  let totalShipping = 0;
  const shippingSeenOrderIds = new Set<string>();

  const result = items.map((item) => {
    const netQuantity = item.quantity - item.returnedQuantity;
    const lineTotal = item.price * netQuantity;
    const unitCost =
      item.costPrice ?? item.productVariant?.purchasePrice ?? item.product.purchasePrice;
    const lineCost = unitCost * netQuantity;

    const orderSubtotal = orderSubtotals.get(item.orderId) || 0;
    const ratio = orderSubtotal > 0 ? lineTotal / orderSubtotal : 0;
    const lineDiscount = (item.order.discountAmount || 0) * ratio;
    const lineProfit = lineTotal - lineCost - lineDiscount;

    totalSales += lineTotal;
    totalCost += lineCost;
    totalDiscount += lineDiscount;
    totalProfit += lineProfit;

    if (!shippingSeenOrderIds.has(item.orderId)) {
      shippingSeenOrderIds.add(item.orderId);
      totalShipping += item.order.shippingFee || 0;
    }

    return {
      id: item.id,
      product: item.product,
      productVariant: item.productVariant,
      price: item.price,
      quantity: item.quantity,
      returnedQuantity: item.returnedQuantity,
      unitCost,
      lineTotal,
      lineCost,
      lineDiscount,
      lineProfit,
      order: item.order,
    };
  });

  return {
    items: result,
    totals: { totalSales, totalCost, totalDiscount, totalShipping, totalProfit },
  };
};

export const ProfitLossService = {
  getProfitLossSummary,
  getProfitLossItems,
};
