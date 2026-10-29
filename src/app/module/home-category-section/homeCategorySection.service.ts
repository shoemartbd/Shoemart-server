import { prisma } from "../../lib/prisma";
import {
  HomeCategoryDisplayType,
  OrderStatus,
  ProductStatus,
} from "../../../generated/prisma/enums";
import { cached, invalidates, MINUTE } from "../../utils/memoryCache";

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  image: true,
  icon: true,
};

const productInclude = {
  category: true,
  shop: true,
  variants: true,
};

const getHomeCategorySections = async () => {
  const sections = await prisma.homeCategorySection.findMany({
    orderBy: { order: "asc" },
    include: { category: { select: categorySelect } },
  });

  return sections;
};

const replaceHomeCategorySections = async (
  sections: { categoryId: string; displayType: HomeCategoryDisplayType }[],
) => {
  await prisma.$transaction([
    prisma.homeCategorySection.deleteMany({}),
    prisma.homeCategorySection.createMany({
      data: sections.map((section, index) => ({
        categoryId: section.categoryId,
        displayType: section.displayType,
        order: index,
      })),
    }),
  ]);

  return getHomeCategorySections();
};

const resolveCategoryProducts = async (
  categoryId: string,
  displayType: HomeCategoryDisplayType,
  limit: number,
) => {
  if (displayType === HomeCategoryDisplayType.LATEST) {
    return prisma.product.findMany({
      where: { categoryId, status: ProductStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: productInclude,
    });
  }

  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      status: OrderStatus.DELIVERED,
      product: { categoryId, status: ProductStatus.ACTIVE },
    },
    _sum: { quantity: true, returnedQuantity: true },
  });

  const rankedIds = grouped
    .map((g) => ({
      productId: g.productId,
      netQuantity: (g._sum.quantity ?? 0) - (g._sum.returnedQuantity ?? 0),
    }))
    .filter((g) => g.netQuantity > 0)
    .sort((a, b) => b.netQuantity - a.netQuantity)
    .slice(0, limit)
    .map((g) => g.productId);

  const rankedProducts = rankedIds.length
    ? await prisma.product.findMany({
        where: { id: { in: rankedIds } },
        include: productInclude,
      })
    : [];

  const rankedProductMap = new Map(rankedProducts.map((p) => [p.id, p]));
  const orderedRanked = rankedIds
    .map((id) => rankedProductMap.get(id))
    .filter((p): p is (typeof rankedProducts)[number] => Boolean(p));

  const remaining = limit - orderedRanked.length;

  if (remaining <= 0) {
    return orderedRanked;
  }

  // Categories with little or no sales history still need a populated
  // section, so pad out with the newest products not already ranked.
  const fallbackProducts = await prisma.product.findMany({
    where: {
      categoryId,
      status: ProductStatus.ACTIVE,
      id: { notIn: rankedIds },
    },
    orderBy: { createdAt: "desc" },
    take: remaining,
    include: productInclude,
  });

  return [...orderedRanked, ...fallbackProducts];
};

const getHomepageSections = async (limit: number) => {
  const sections = await prisma.homeCategorySection.findMany({
    orderBy: { order: "asc" },
    include: { category: { select: categorySelect } },
  });

  const result = await Promise.all(
    sections.map(async (section) => ({
      id: section.id,
      displayType: section.displayType,
      order: section.order,
      category: section.category,
      products: await resolveCategoryProducts(
        section.categoryId,
        section.displayType,
        limit,
      ),
    })),
  );

  return result;
};

// The homepage version includes products (prices, stock), so it keeps a
// short TTL and is also cleared whenever a product changes
export const HomeCategorySectionService = {
  getHomeCategorySections,
  replaceHomeCategorySections: invalidates(["home-sections"], replaceHomeCategorySections),
  resolveCategoryProducts,
  getHomepageSections: cached("home-sections", MINUTE, getHomepageSections),
};
