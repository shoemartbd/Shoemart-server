import { prisma } from "../../lib/prisma";
import { cached, invalidates, MINUTE } from "../../utils/memoryCache";

const getSiteSettings = async () => {
  let settings = await prisma.siteSetting.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    settings = await prisma.siteSetting.create({
      data: { id: "default" },
    });
  }

  return settings;
};

const updateSiteSettings = async (payload: {
  siteName?: string;
  tagline?: string;
  description?: string;
  logo?: string;
  phone?: string;
  email?: string;
  address?: string;
  facebook?: string;
  youtube?: string;
  instagram?: string;
  linkedin?: string;
  tiktok?: string;
  whatsapp?: string;
  copyrightText?: string;
  lowStockThreshold?: number;
  guestCheckoutEnabled?: boolean;
}) => {
  // Ensure the default settings row exists first
  await getSiteSettings();

  const result = await prisma.siteSetting.update({
    where: { id: "default" },
    data: payload,
  });

  return result;
};

// Read on every storefront page; cached, cleared when saved
export const SiteSettingService = {
  getSiteSettings: cached("site-settings", 5 * MINUTE, getSiteSettings),
  updateSiteSettings: invalidates(["site-settings"], updateSiteSettings),
};
