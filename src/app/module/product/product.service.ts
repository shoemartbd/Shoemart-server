import status from "http-status";
import { prisma } from "../../lib/prisma";
import { IQueryParams } from "../../interfaces/query.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import AppError from "../../errorHelpers/AppError";
import { generateUniqueSlug } from "../../utils/generateSlug";
import { generateUniqueSku } from "../../utils/generateSku";
import { ProductHighlight, ProductStatus } from "../../../generated/prisma/enums";
import { ShopService } from "../shop/shop.service";
import { queueProductIndexSync } from "../rag/ragSync";
import { cached, invalidates, MINUTE } from "../../utils/memoryCache";

const createProduct = async (payload: any) => {
  // 1. Verify category exists
  const category = await prisma.category.findUnique({
    where: { id: payload.categoryId },
  });

  if (!category) {
    throw new AppError(status.NOT_FOUND, "Category not found");
  }

  // 2. Resolve the store (single-vendor: always the one seeded shop)
  const shopId = await ShopService.getDefaultShopId();

  // 3. Generate unique slug
  const slug = await generateUniqueSlug(prisma, payload.name, "product");

  const { variants, ...productData } = payload;

  const product = await prisma.product.create({
    data: {
      ...productData,
      shopId,
      slug,
      status: ProductStatus.ACTIVE,
      ...(variants && variants.length > 0 && {
        variants: {
          create: variants,
        },
      }),
    },
    include: {
      category: true,
      brand: true,
      sizeChart: true,
      shop: true,
      variants: true,
    },
  });

  return product;
};

const generateSku = async () => {
  const sku = await generateUniqueSku(prisma);
  return { sku };
};

// The given category ids plus every subcategory below them, at any depth
const withSubcategoryIds = async (ids: string[]) => {
  const all = await prisma.category.findMany({
    select: { id: true, parentId: true },
  });
  const result = new Set(ids);
  let added = true;
  while (added) {
    added = false;
    for (const c of all) {
      if (c.parentId && result.has(c.parentId) && !result.has(c.id)) {
        result.add(c.id);
        added = true;
      }
    }
  }
  return [...result];
};

const getAllProducts = async (queryParams: IQueryParams) => {
  const {
    minPrice,
    maxPrice,
    categoryId,
    sortBy,
    highlight,
    searchTerm,
    view,
    ...remainingQuery
  } = queryParams;

  const filter: any = { ...remainingQuery };

  // Default to ACTIVE products for general listing
  if (!filter.status) {
    filter.status = ProductStatus.ACTIVE;
  }

  if (minPrice || maxPrice) {
    filter.sellPrice = {};
    if (minPrice) filter.sellPrice.gte = Number(minPrice);
    if (maxPrice) filter.sellPrice.lte = Number(maxPrice);
  }

  if (categoryId) {
    const selected = Array.isArray(categoryId)
      ? categoryId
      : String(categoryId).split(",");
    // A category also shows the products of all its subcategories
    filter.categoryId = { in: await withSubcategoryIds(selected) };
  }

  // Map sortBy values
  if (sortBy) {
    if (sortBy === "price_asc") {
      filter.sortBy = "sellPrice";
      filter.sortOrder = "asc";
    } else if (sortBy === "price_desc") {
      filter.sortBy = "sellPrice";
      filter.sortOrder = "desc";
    } else if (sortBy === "newest") {
      filter.sortBy = "createdAt";
      filter.sortOrder = "desc";
    } else if (sortBy === "popularity") {
      filter.sortBy = "reviews"; 
      filter.sortOrder = "desc";
    }
  }


  const productQuery = new QueryBuilder(prisma.product, filter, {
    filterableFields: ["categoryId", "brandId", "shopId", "status", "sellPrice"],
  })
    .filter()
    .sort()
    .paginate();

  // Storefront / POS search: every word must appear in the name (any order),
  // or the term matches a barcode (product or variant SKU), a tag, the
  // category or the brand
  const term = typeof searchTerm === "string" ? searchTerm.trim() : "";
  if (term) {
    const contains = (value: string) => ({
      contains: value,
      mode: "insensitive" as const,
    });
    const words = term.split(/\s+/).filter(Boolean);

    productQuery.where({
      OR: [
        { AND: words.map((word) => ({ name: contains(word) })) },
        { sku: contains(term) },
        { variants: { some: { sku: contains(term) } } },
        { tags: { hasSome: [term, term.toLowerCase()] } },
        { category: { name: contains(term) } },
        { brand: { name: contains(term) } },
      ],
    });
  }

  // ?highlight=TRENDING -> products carrying that label (for homepage sections)
  if (
    typeof highlight === "string" &&
    Object.values(ProductHighlight).includes(highlight as ProductHighlight)
  ) {
    productQuery.where({
      highlights: { has: highlight as ProductHighlight },
    });
  }

  // ?view=card: storefront grids and sliders. They never show the HTML
  // description, cost price, shop or size chart, which made lists heavy.
  if (view === "card") {
    productQuery
      .omit({ description: true, purchasePrice: true })
      .include({
        category: true,
        brand: true,
        variants: { omit: { purchasePrice: true } },
      });
  } else {
    productQuery.include({
      category: true,
      brand: true,
      sizeChart: true,
      shop: true,
      variants: true,
    });
  }

  const result = await productQuery.execute();

  return result;
};

const getProductById = async (id: string) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      brand: true,
      sizeChart: true,
      shop: true,
      variants: true,
      reviews: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  return product;
};

const getProductBySlug = async (slug: string) => {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      brand: true,
      sizeChart: true,
      shop: true,
      variants: true,
      reviews: true,
    },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  return product;
};

const updateProduct = async (id: string, payload: any) => {
  const existingProduct = await prisma.product.findUnique({
    where: { id },
  });

  if (!existingProduct) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  let slug: string | undefined;
  if (payload.name && payload.name !== existingProduct.name) {
    slug = await generateUniqueSlug(prisma, payload.name, "product", id);
  }

  const { variants, ...productData } = payload;

  const updatedProduct = await prisma.$transaction(async (tx) => {
    if (variants !== undefined) {
      await tx.productVariant.deleteMany({
        where: { productId: id },
      });

      if (variants && variants.length > 0) {
        await tx.productVariant.createMany({
          data: variants.map((v: any) => ({
            ...v,
            productId: id,
          })),
        });
      }
    }

    return await tx.product.update({
      where: { id },
      data: {
        ...productData,
        ...(slug && { slug }),
      },
      include: {
        category: true,
        brand: true,
        sizeChart: true,
        shop: true,
        variants: true,
      },
    });
  });

  return updatedProduct;
};

const getProductVariants = async (productId: string) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: true },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  return product.variants;
};

const uploadVariantImage = async (
  productId: string,
  variantId: string,
  imageUrl: string,
) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
  });

  if (!variant || variant.productId !== productId) {
    throw new AppError(status.NOT_FOUND, "Variant not found for this product");
  }

  const updated = await prisma.productVariant.update({
    where: { id: variantId },
    data: { image: imageUrl },
  });

  return updated;
};

const deleteProduct = async (id: string) => {
  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  // Soft delete by changing status
  await prisma.product.update({
    where: { id },
    data: { status: ProductStatus.DELETED },
  });

  return { message: "Product deleted successfully" };
};

// Soft-deletes the products selected in the admin list
const bulkDeleteProducts = async (productIds: string[]) => {
  const ids = [...new Set(productIds)];
  const { count } = await prisma.product.updateMany({
    where: { id: { in: ids }, status: { not: ProductStatus.DELETED } },
    data: { status: ProductStatus.DELETED },
  });
  ids.forEach((id) => queueProductIndexSync(id));
  return { deleted: count };
};

// Cached views that include product data
const PRODUCT_VIEWS = ["home-sections", "flash-sale"];

// Keep the chatbot's copy of a product current (runs in the background)
const withIndexSync =
  <A extends unknown[], R>(pickId: (args: A, result: R) => string | undefined, fn: (...args: A) => Promise<R>) =>
  async (...args: A): Promise<R> => {
    const result = await fn(...args);
    queueProductIndexSync(pickId(args, result));
    return result;
  };

export const ProductService = {
  createProduct: invalidates(
    PRODUCT_VIEWS,
    withIndexSync((_args, product: Awaited<ReturnType<typeof createProduct>>) => product?.id, createProduct),
  ),
  generateSku,
  getAllProducts,
  getProductById,
  getProductBySlug,
  updateProduct: invalidates(
    PRODUCT_VIEWS,
    withIndexSync(([id]) => id, updateProduct),
  ),
  deleteProduct: invalidates(
    PRODUCT_VIEWS,
    withIndexSync(([id]) => id, deleteProduct),
  ),
  bulkDeleteProducts: invalidates(PRODUCT_VIEWS, bulkDeleteProducts),
  getProductVariants,
  uploadVariantImage,
};
