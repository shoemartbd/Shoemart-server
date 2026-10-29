import z from "zod";

const abandonedCheckoutItemZodSchema = z.object({
  productId: z.string(),
  productVariantId: z.string().nullable().optional(),
  name: z.string(),
  variantName: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
  price: z.number(),
});

export const trackAbandonedCheckoutZodSchema = z.object({
  sessionToken: z.string().min(1, "Session token is required"),
  source: z.enum(["STOREFRONT", "LANDING_PAGE"]).optional(),
  landingPageSlug: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(abandonedCheckoutItemZodSchema).optional(),
  subtotal: z.number().optional(),
  shippingFee: z.number().optional(),
  discountAmount: z.number().optional(),
  total: z.number().optional(),
});
