import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { ProductStatus, ProductType } from "../../../generated/prisma/enums";

const DEFAULT_THRESHOLD = 5;

export interface ILowStockRow {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  slug: string;
  image: string | null;
  sku: string | null;
  combination: string | null;
  category: string | null;
  stock: number;
}

const getThreshold = async () => {
  const settings = await prisma.siteSetting.findUnique({
    where: { id: "default" },
    select: { lowStockThreshold: true },
  });
  return settings?.lowStockThreshold ?? DEFAULT_THRESHOLD;
};

// Simple products are checked on their own stock, variable products per
// variant, since the product total can look fine while one size is gone
const findLowStockRows = async (threshold: number, searchTerm?: string) => {
  const term = searchTerm?.trim();
  const contains = (value: string) => ({
    contains: value,
    mode: "insensitive" as const,
  });
  const notDeleted = { status: { not: ProductStatus.DELETED } };

  const [simpleProducts, variants] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...notDeleted,
        type: ProductType.SIMPLE,
        stock: { lte: threshold },
        ...(term && { OR: [{ name: contains(term) }, { sku: contains(term) }] }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        images: true,
        sku: true,
        stock: true,
        category: { select: { name: true } },
      },
    }),
    prisma.productVariant.findMany({
      where: {
        quantity: { lte: threshold },
        product: { ...notDeleted, type: ProductType.VARIABLE },
        ...(term && {
          OR: [
            { sku: contains(term) },
            { combination: contains(term) },
            { product: { name: contains(term) } },
          ],
        }),
      },
      select: {
        id: true,
        combination: true,
        sku: true,
        quantity: true,
        image: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: true,
            sku: true,
            category: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const rows: ILowStockRow[] = [
    ...simpleProducts.map((p) => ({
      key: p.id,
      productId: p.id,
      variantId: null,
      name: p.name,
      slug: p.slug,
      image: p.images[0] ?? null,
      sku: p.sku,
      combination: null,
      category: p.category?.name ?? null,
      stock: p.stock,
    })),
    ...variants.map((v) => ({
      key: v.id,
      productId: v.product.id,
      variantId: v.id,
      name: v.product.name,
      slug: v.product.slug,
      image: v.image || v.product.images[0] || null,
      sku: v.sku || v.product.sku,
      combination: v.combination,
      category: v.product.category?.name ?? null,
      stock: v.quantity,
    })),
  ];

  // Most urgent first
  return rows.sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
};

const getLowStock = async (queryParams: IQueryParams) => {
  const threshold = await getThreshold();
  const searchTerm =
    typeof queryParams.searchTerm === "string" ? queryParams.searchTerm : "";
  const type =
    queryParams.type === "out" || queryParams.type === "low"
      ? queryParams.type
      : "all";
  const page = Math.max(1, Number(queryParams.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(queryParams.limit) || 20));

  const allRows = await findLowStockRows(threshold, searchTerm);
  const outCount = allRows.filter((r) => r.stock <= 0).length;
  const rows =
    type === "out"
      ? allRows.filter((r) => r.stock <= 0)
      : type === "low"
        ? allRows.filter((r) => r.stock > 0)
        : allRows;

  return {
    data: {
      rows: rows.slice((page - 1) * limit, page * limit),
      counts: {
        all: allRows.length,
        low: allRows.length - outCount,
        out: outCount,
      },
      threshold,
    },
    meta: {
      page,
      limit,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / limit)),
    },
  };
};

// Counts for the dashboard cards
const getLowStockCounts = async () => {
  const threshold = await getThreshold();
  const rows = await findLowStockRows(threshold);
  const out = rows.filter((r) => r.stock <= 0).length;
  return { threshold, low: rows.length - out, out, all: rows.length };
};

// Set the stock of a simple product or of one variant. A variant change also
// moves the product total by the same amount, as orders and returns do.
const updateStock = async (payload: {
  productId: string;
  variantId?: string | null;
  stock: number;
}) => {
  const product = await prisma.product.findUnique({
    where: { id: payload.productId },
    select: { id: true, type: true, status: true },
  });
  if (!product || product.status === ProductStatus.DELETED) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  // A product marked out of stock becomes sellable again once restocked
  const reactivate =
    product.status === ProductStatus.OUT_OF_STOCK && payload.stock > 0
      ? { status: ProductStatus.ACTIVE }
      : {};

  if (payload.variantId) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: payload.variantId, productId: product.id },
      select: { quantity: true },
    });
    if (!variant) throw new AppError(status.NOT_FOUND, "Variant not found");

    const delta = payload.stock - variant.quantity;
    await prisma.$transaction([
      prisma.productVariant.update({
        where: { id: payload.variantId },
        data: { quantity: payload.stock },
      }),
      prisma.product.update({
        where: { id: product.id },
        data: { stock: { increment: delta }, ...reactivate },
      }),
    ]);
  } else {
    if (product.type === ProductType.VARIABLE) {
      throw new AppError(
        status.BAD_REQUEST,
        "Set the stock of a variable product per variant",
      );
    }
    await prisma.product.update({
      where: { id: product.id },
      data: { stock: payload.stock, ...reactivate },
    });
  }

  return {
    productId: product.id,
    variantId: payload.variantId ?? null,
    stock: payload.stock,
  };
};

export const LowStockService = {
  getLowStock,
  getLowStockCounts,
  updateStock,
};
