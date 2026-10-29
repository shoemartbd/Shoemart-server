import { Request } from "express";
import { prisma } from "../../lib/prisma";
import { cached, invalidates, MINUTE } from "../../utils/memoryCache";

const ID = "default";

const getHomePromo = async () => {
  return (
    (await prisma.homePromo.findUnique({ where: { id: ID } })) ??
    (await prisma.homePromo.create({ data: { id: ID } }))
  );
};

const parseBoolean = (value: unknown) =>
  value === undefined ? undefined : value === true || value === "true";

// Text fields: undefined = leave as is, "" = clear
const parseText = (value: unknown) =>
  typeof value === "string" ? value.trim() || null : undefined;

const updateHomePromo = async (req: Request) => {
  await getHomePromo();
  const body = req.body ?? {};
  const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
  const file = files.bannerImage?.[0];
  const productsFile = files.productsBannerImage?.[0];

  return prisma.homePromo.update({
    where: { id: ID },
    data: {
      tickerText: parseText(body.tickerText),
      tickerEnabled: parseBoolean(body.tickerEnabled),
      bannerLink: parseText(body.bannerLink),
      bannerEnabled: parseBoolean(body.bannerEnabled),
      ...(file
        ? { bannerImage: file.path }
        : parseBoolean(body.removeBanner)
          ? { bannerImage: null }
          : {}),
      productsBannerLink: parseText(body.productsBannerLink),
      productsBannerEnabled: parseBoolean(body.productsBannerEnabled),
      ...(productsFile
        ? { productsBannerImage: productsFile.path }
        : parseBoolean(body.removeProductsBanner)
          ? { productsBannerImage: null }
          : {}),
    },
  });
};

export const HomePromoService = {
  getHomePromo: cached("home-promo", 5 * MINUTE, getHomePromo),
  updateHomePromo: invalidates(["home-promo"], updateHomePromo),
};
