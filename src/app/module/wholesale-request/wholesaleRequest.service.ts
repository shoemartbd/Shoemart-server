import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { Role, WholesaleRequestStatus } from "../../../generated/prisma/enums";
import { normalizePhone } from "../blocked-phone/blockedPhone.service";
import { sumByPeriod } from "../../utils/periodSummary";
import {
  imageFor,
  matchColour,
  readColours,
  wholesaleCode,
} from "../wholesale-product/wholesaleProduct.service";

// One order line, stored in the `products` JSON column
export interface IWholesaleLine {
  productId: string;
  code: string;
  name: string;
  image: string | null;
  color: string | null; // picked colour
  quantity: number; // pairs
  unitPrice: number; // wholesale price per pair, set by the admin
  costPrice: number; // purchase price per pair, for the profit report
}

export interface ICreateWholesaleRequest {
  name: string;
  phone: string;
  email?: string;
  businessName?: string;
  businessType?: string;
  location?: string;
  categories?: string[];
  items?: { productId: string; quantity: number; color?: string }[];
  message?: string;
}

export interface IUpdateWholesaleRequest {
  status?: WholesaleRequestStatus;
  adminNote?: string;
  items?: {
    productId: string;
    color?: string;
    quantity: number;
    unitPrice: number;
    costPrice?: number;
  }[];
  deliveryCharge?: number;
  paidAmount?: number;
  // Wholesaler account the request belongs to; null unlinks it
  userId?: string | null;
}

const optional = (value?: string) => value?.trim() || null;

// Order lines come from Dashboard → Wholesale Products (not the shop catalogue).
// They have no cost price: the admin enters it per line for the profit report.
const productSelect = {
  id: true,
  codeNo: true,
  name: true,
  images: true,
  colors: true,
};

type ProductRow = {
  id: string;
  codeNo: number;
  name: string;
  images: string[];
  colors: unknown;
};

const codeOf = (p: ProductRow) => wholesaleCode(p.codeNo);
const imageOf = (p: ProductRow, colour: string | null) => imageFor(p, colour);

// One line per product + colour
const lineKey = (productId: string, colour?: string | null) =>
  `${productId}|${colour?.trim().toLowerCase() ?? ""}`;

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// The stored JSON, read defensively (old rows have no quantity / prices)
export const readLines = (value: unknown): IWholesaleLine[] =>
  (Array.isArray(value) ? value : []).flatMap((raw) => {
    const r = raw as Partial<IWholesaleLine>;
    if (!r?.productId) return [];
    return [
      {
        productId: String(r.productId),
        code: String(r.code ?? ""),
        name: String(r.name ?? ""),
        image: r.image ?? null,
        color: typeof r.color === "string" && r.color.trim() ? r.color.trim() : null,
        quantity: Math.max(0, Math.round(Number(r.quantity) || 0)),
        unitPrice: round2(Number(r.unitPrice) || 0),
        costPrice: round2(Number(r.costPrice) || 0),
      },
    ];
  });

// Wholesale has no discount: the admin quotes the price per pair instead
const totalsOf = (r: {
  products: unknown;
  deliveryCharge: number;
  paidAmount: number;
}) => {
  const lines = readLines(r.products);
  const pairs = lines.reduce((s, l) => s + l.quantity, 0);
  const subtotal = round2(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
  const cost = round2(lines.reduce((s, l) => s + l.quantity * l.costPrice, 0));
  const total = round2(subtotal + r.deliveryCharge);
  // Delivery is passed on to the buyer, so like the shop P&L it isn't profit
  const profit = round2(subtotal - cost);
  const due = round2(total - r.paidAmount);
  return { pairs, subtotal, cost, total, profit, due };
};

// Picked gallery products, looked up here (never trusted from the browser) and
// limited to what the gallery shows: active wholesale products.
// A colour is kept only when it is one of the product's colours.
// Prices are left for the admin to quote.
const snapshotRequestedProducts = async (
  items: { productId: string; quantity: number; color?: string }[] = [],
): Promise<IWholesaleLine[]> => {
  if (items.length === 0) return [];

  const products = await prisma.wholesaleProduct.findMany({
    where: {
      id: { in: [...new Set(items.map((i) => i.productId))] },
      isActive: true,
    },
    select: productSelect,
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  // One line per product + colour (a repeat adds up its pairs), in the
  // order the buyer picked them
  const lines = new Map<string, IWholesaleLine>();
  for (const item of items) {
    const p = byId.get(item.productId);
    if (!p) continue;
    const color = matchColour(p.colors, item.color);
    const key = lineKey(p.id, color);
    const prev = lines.get(key);
    if (prev) {
      prev.quantity += item.quantity;
      continue;
    }
    lines.set(key, {
      productId: p.id,
      code: codeOf(p),
      name: p.name,
      image: imageOf(p, color),
      color,
      quantity: item.quantity,
      unitPrice: 0,
      costPrice: 0,
    });
  }
  return [...lines.values()];
};

// From the public landing page form. A logged-in wholesaler's request is
// linked to their account so it shows in their dashboard.
const createRequest = async (
  payload: ICreateWholesaleRequest,
  requester?: { userId: string; role: string },
) => {
  const phone = normalizePhone(payload.phone);
  if (!/^01\d{9}$/.test(phone)) {
    throw new AppError(status.BAD_REQUEST, "Enter a valid 11-digit mobile number (01XXXXXXXXX)");
  }

  const lines = await snapshotRequestedProducts(payload.items);

  return prisma.wholesaleRequest.create({
    data: {
      name: payload.name.trim(),
      phone,
      email: optional(payload.email),
      businessName: optional(payload.businessName),
      businessType: optional(payload.businessType),
      location: optional(payload.location),
      categories: (payload.categories ?? []).map((c) => c.trim()).filter(Boolean),
      products: lines as object[],
      message: optional(payload.message),
      ...(requester?.role === Role.WHOLESALER && { userId: requester.userId }),
    },
  });
};

const accountSelect = { select: { id: true, name: true, email: true } };

type RequestRow = { products: unknown; deliveryCharge: number; paidAmount: number };

// Each line also carries its product's colours, for the admin's colour picker
const withTotals = async <T extends RequestRow>(rows: T[]) => {
  const parsed = rows.map((row) => readLines(row.products));
  const ids = [...new Set(parsed.flat().map((l) => l.productId))];
  const products = ids.length
    ? await prisma.wholesaleProduct.findMany({
        where: { id: { in: ids } },
        select: { id: true, colors: true },
      })
    : [];
  const colours = new Map(products.map((p) => [p.id, readColours(p.colors).map((c) => c.name)]));

  return rows.map((row, i) => ({
    ...row,
    products: parsed[i].map((l) => ({ ...l, colorOptions: colours.get(l.productId) ?? [] })),
    totals: totalsOf(row),
  }));
};

const getRequests = async (query: { status?: string; searchTerm?: string }) => {
  const term = query.searchTerm?.trim();
  const statusFilter = Object.values(WholesaleRequestStatus).includes(
    query.status as WholesaleRequestStatus,
  )
    ? (query.status as WholesaleRequestStatus)
    : undefined;
  const invoiceNo = term ? Number(term.replace(/^ws-?/i, "")) : NaN;

  const [data, counts] = await Promise.all([
    prisma.wholesaleRequest.findMany({
      where: {
        ...(statusFilter && { status: statusFilter }),
        ...(term && {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { phone: { contains: normalizePhone(term) || term } },
            { businessName: { contains: term, mode: "insensitive" } },
            { location: { contains: term, mode: "insensitive" } },
            ...(Number.isInteger(invoiceNo) && invoiceNo > 0 && invoiceNo < 2 ** 31
              ? [{ invoiceNo }]
              : []),
          ],
        }),
      },
      orderBy: { createdAt: "desc" },
      include: { user: accountSelect },
    }),
    prisma.wholesaleRequest.groupBy({ by: ["status"], _count: true }),
  ]);

  // Per-status totals for the filter tabs
  const summary = Object.fromEntries(
    Object.values(WholesaleRequestStatus).map((s) => [
      s,
      counts.find((c) => c.status === s)?._count ?? 0,
    ]),
  );

  return { data: await withTotals(data), summary };
};

// The admin's edited order lines. Lines already on the request keep their
// snapshot (name, code, photo); new products are looked up from the
// catalogue. The admin may set any colour (one of the product's, or a new one).
const buildAdminLines = async (
  existing: IWholesaleLine[],
  items: NonNullable<IUpdateWholesaleRequest["items"]>,
): Promise<IWholesaleLine[]> => {
  const known = new Map(existing.map((l) => [lineKey(l.productId, l.color), l]));
  const knownProduct = new Map(existing.map((l) => [l.productId, l]));

  const ids = [...new Set(items.map((i) => i.productId))];
  const fresh = ids.length
    ? await prisma.wholesaleProduct.findMany({ where: { id: { in: ids } }, select: productSelect })
    : [];
  const freshById = new Map(fresh.map((p) => [p.id, p]));

  const lines = new Map<string, IWholesaleLine>();
  for (const item of items) {
    const p = freshById.get(item.productId);
    const old = knownProduct.get(item.productId);
    if (!p && !old) {
      throw new AppError(status.BAD_REQUEST, "One of the products no longer exists");
    }
    // Keep the product's own spelling of a known colour
    const typed = item.color?.trim() || null;
    const color = (p && matchColour(p.colors, typed)) || typed;
    const key = lineKey(item.productId, color);

    const prev = lines.get(key);
    if (prev) {
      prev.quantity += item.quantity;
      continue;
    }

    const same = known.get(key);
    const base = same ?? {
      productId: item.productId,
      code: p ? codeOf(p) : old!.code,
      name: p ? p.name : old!.name,
      image: p ? imageOf(p, color) : old!.image,
      costPrice: old?.costPrice ?? 0,
    };
    lines.set(key, {
      productId: base.productId,
      code: base.code,
      name: base.name,
      image: base.image,
      color,
      quantity: item.quantity,
      unitPrice: round2(item.unitPrice),
      costPrice: round2(item.costPrice ?? base.costPrice),
    });
  }
  return [...lines.values()];
};

const updateRequest = async (id: string, payload: IUpdateWholesaleRequest) => {
  const existing = await prisma.wholesaleRequest.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Wholesale request not found");

  const lines = payload.items
    ? await buildAdminLines(readLines(existing.products), payload.items)
    : readLines(existing.products);

  if (payload.userId) {
    const account = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true, isDeleted: true },
    });
    if (!account || account.isDeleted || account.role !== Role.WHOLESALER) {
      throw new AppError(status.BAD_REQUEST, "Choose a wholesaler account");
    }
  }

  const nextStatus = payload.status ?? existing.status;
  if (nextStatus === WholesaleRequestStatus.COMPLETED && lines.length === 0) {
    throw new AppError(status.BAD_REQUEST, "Add at least one product before completing the sale");
  }

  // Report date: set when the sale is completed, cleared if it is reopened
  const completedAt =
    nextStatus === WholesaleRequestStatus.COMPLETED
      ? (existing.completedAt ?? new Date())
      : null;

  const updated = await prisma.wholesaleRequest.update({
    where: { id },
    data: {
      status: nextStatus,
      completedAt,
      ...(payload.adminNote !== undefined && { adminNote: optional(payload.adminNote) }),
      ...(payload.items && { products: lines as object[] }),
      // Discount is no longer used; clear any old value
      discount: 0,
      ...(payload.deliveryCharge !== undefined && {
        deliveryCharge: round2(payload.deliveryCharge),
      }),
      ...(payload.paidAmount !== undefined && { paidAmount: round2(payload.paidAmount) }),
      ...(payload.userId !== undefined && { userId: payload.userId || null }),
    },
    include: { user: accountSelect },
  });
  return (await withTotals([updated]))[0];
};

const deleteRequest = async (id: string) => {
  const existing = await prisma.wholesaleRequest.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Wholesale request not found");
  await prisma.wholesaleRequest.delete({ where: { id } });
  return { id };
};

// Admin "Add product" search: wholesale products by name or code (WP-0007 / 7)
const searchProducts = async (searchTerm?: string) => {
  const term = searchTerm?.trim();
  const codeNo = term ? Number(term.replace(/^wp-?/i, "")) : NaN;
  const products = await prisma.wholesaleProduct.findMany({
    where: {
      ...(term && {
        OR: [
          { name: { contains: term, mode: "insensitive" as const } },
          ...(Number.isInteger(codeNo) && codeNo > 0 && codeNo < 2 ** 31 ? [{ codeNo }] : []),
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: productSelect,
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    code: codeOf(p),
    image: p.images[0] ?? null,
    colorOptions: readColours(p.colors).map((c) => c.name),
  }));
};

// Completed wholesale sales: per-sale rows for a date range plus period
// totals, dated by when the sale was completed
const getReport = async (range: { startDate?: string; endDate?: string }) => {
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

  const all = await prisma.wholesaleRequest.findMany({
    where: { status: WholesaleRequestStatus.COMPLETED },
    orderBy: { completedAt: "desc" },
  });

  const rows = all.map((r) => {
    const t = totalsOf(r);
    return {
      id: r.id,
      invoiceNo: r.invoiceNo,
      name: r.name,
      phone: r.phone,
      businessName: r.businessName,
      completedAt: r.completedAt ?? r.updatedAt,
      deliveryCharge: r.deliveryCharge,
      paidAmount: r.paidAmount,
      ...t,
    };
  });

  const period = (pick: (row: (typeof rows)[number]) => number) =>
    sumByPeriod(rows.map((row) => ({ amount: pick(row), date: new Date(row.completedAt) })));

  const summary = {
    sales: period((r) => r.subtotal),
    cost: period((r) => r.cost),
    profit: period((r) => r.profit),
    pairs: period((r) => r.pairs),
    due: period((r) => r.due),
  };

  const inRange = rows.filter((r) => {
    const d = new Date(r.completedAt);
    return (!dateFilter?.gte || d >= dateFilter.gte) && (!dateFilter?.lte || d <= dateFilter.lte);
  });

  const sum = (pick: (row: (typeof rows)[number]) => number) =>
    round2(inRange.reduce((s, r) => s + pick(r), 0));

  return {
    summary,
    items: inRange,
    totals: {
      sales: inRange.length,
      pairs: sum((r) => r.pairs),
      subtotal: sum((r) => r.subtotal),
      deliveryCharge: sum((r) => r.deliveryCharge),
      total: sum((r) => r.total),
      cost: sum((r) => r.cost),
      profit: sum((r) => r.profit),
      paid: sum((r) => r.paidAmount),
      due: sum((r) => r.due),
    },
  };
};

// Admin: wholesaler accounts a request can be linked to
const getWholesalers = async () =>
  prisma.user.findMany({
    where: { role: Role.WHOLESALER, isDeleted: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

// Wholesaler dashboard: their own requests, without internal figures
// (cost, profit, admin note)
const getMyRequests = async (userId: string) => {
  const rows = await prisma.wholesaleRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => {
    const t = totalsOf(r);
    return {
      id: r.id,
      invoiceNo: r.invoiceNo,
      name: r.name,
      phone: r.phone,
      email: r.email,
      businessName: r.businessName,
      location: r.location,
      status: r.status,
      message: r.message,
      products: readLines(r.products).map((l) => ({
        productId: l.productId,
        code: l.code,
        name: l.name,
        image: l.image,
        color: l.color,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      deliveryCharge: r.deliveryCharge,
      paidAmount: r.paidAmount,
      totals: { pairs: t.pairs, subtotal: t.subtotal, total: t.total, due: t.due },
      completedAt: r.completedAt,
      createdAt: r.createdAt,
    };
  });
};

export const WholesaleRequestService = {
  getWholesalers,
  getMyRequests,
  createRequest,
  getRequests,
  updateRequest,
  deleteRequest,
  searchProducts,
  getReport,
};
