import { Request, Response, Router } from "express";
import { prisma } from "../../lib/prisma";
import { ProductStatus } from "../../../generated/prisma/enums";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { cached, MINUTE } from "../../utils/memoryCache";

// Public: what the storefront's sitemap.xml lists. Only live content (active
// products, published blog posts), with just the fields a sitemap needs.
const getSitemapData = cached("seo-sitemap", 10 * MINUTE, async () => {
  const [products, blogs] = await Promise.all([
    prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      orderBy: { updatedAt: "desc" },
      select: { slug: true, name: true, images: true, updatedAt: true },
      take: 50000, // sitemap file limit
    }),
    prisma.blog.findMany({
      where: { isPublished: true },
      orderBy: { updatedAt: "desc" },
      select: { slug: true, title: true, coverImage: true, updatedAt: true },
      take: 5000,
    }),
  ]);
  return {
    products: products.map((p) => ({
      slug: p.slug,
      name: p.name,
      images: p.images.slice(0, 5),
      updatedAt: p.updatedAt,
    })),
    blogs,
  };
});

const router = Router();

router.get(
  "/sitemap",
  catchAsync(async (_req: Request, res: Response) => {
    const data = await getSitemapData();
    sendResponse(res, { httpStatusCode: 200, success: true, message: "Sitemap data", data });
  }),
);

export const SeoRoutes = router;
