import { z } from "zod";

export const updateSiteSettingZodSchema = z.object({
  siteName: z.string().min(1).optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  email: z.email().optional().or(z.literal("")),
  address: z.string().optional(),
  facebook: z.url().optional().or(z.literal("")),
  youtube: z.url().optional().or(z.literal("")),
  instagram: z.url().optional().or(z.literal("")),
  linkedin: z.url().optional().or(z.literal("")),
  tiktok: z.url().optional().or(z.literal("")),
  whatsapp: z.string().optional(),
  copyrightText: z.string().optional(),
  lowStockThreshold: z.coerce.number().int().min(0).max(100000).optional(),
  guestCheckoutEnabled: z.boolean().optional(),
});
