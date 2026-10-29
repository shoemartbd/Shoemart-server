import z from "zod";

export const bulkDeleteProductZodSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1, "Select at least one product").max(200),
});

const variantSchema = z.object({
  combination: z.string().min(1, "Combination is required"),
  sku: z.string().trim().min(1).optional().nullable(),
  quantity: z.number().int().nonnegative("Quantity cannot be negative"),
  purchasePrice: z.number().positive("Purchase price must be positive"),
  regularPrice: z.number().positive("Regular price must be positive"),
  sellPrice: z.number().positive("Sell price must be positive"),
  image: z.string().optional().nullable(),
});

// YouTube / Facebook link; "" clears it (stored as null)
const isYoutubeOrFacebook = (value: string) => {
  try {
    return /(^|\.)(youtube\.com|youtu\.be|facebook\.com|fb\.watch)$/i.test(
      new URL(value).hostname,
    );
  } catch {
    return false;
  }
};

const videoUrlSchema = z
  .union([
    z.literal(""),
    z
      .url("Enter a valid video link")
      .refine(isYoutubeOrFacebook, "Only YouTube or Facebook video links are supported"),
  ])
  .nullable()
  .optional()
  .transform((v) => (v === "" ? null : v));

export const createProductZodSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().min(1, "Description is required"),
  shortDescription: z.string().min(1, "Short description is required"),
  videoUrl: videoUrlSchema,
  sku: z.string().trim().min(1).optional().nullable(),
  stock: z.number().int().nonnegative("Stock cannot be negative"),
  purchasePrice: z.number().positive("Purchase price must be positive"),
  regularPrice: z.number().positive("Regular price must be positive"),
  sellPrice: z.number().positive("Sell price must be positive"),
  categoryId: z.string().uuid("Invalid category ID"),
  brandId: z.string().uuid("Invalid brand ID").optional().nullable(),
  sizeChartId: z.string().uuid("Invalid size chart ID").optional().nullable(),
  tags: z.array(z.string()).optional(),
  type: z.enum(["SIMPLE", "VARIABLE"]).optional().default("SIMPLE"),
  attributes: z.any().optional(),
  variants: z.array(variantSchema).optional(),
  vatType: z.enum(["INCLUDED", "EXCLUDED"]).optional().default("INCLUDED"),
  vatPercentage: z.coerce.number().nonnegative().optional().default(0),
  freeShipping: z.coerce.boolean().optional().default(false),
  highlights: z.array(z.enum(["NEW_ARRIVAL", "TRENDING", "TOP_SELLING", "OUR_SERVICE"])).optional().default([]),
});

export const updateProductZodSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  videoUrl: videoUrlSchema,
  sku: z.string().trim().min(1).optional().nullable(),
  stock: z.number().int().nonnegative().optional(),
  purchasePrice: z.number().positive().optional(),
  regularPrice: z.number().positive().optional(),
  sellPrice: z.number().positive().optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional().nullable(),
  sizeChartId: z.string().uuid().optional().nullable(),
  status: z.enum(["ACTIVE", "DRAFT", "OUT_OF_STOCK", "DELETED"]).optional(),
  tags: z.array(z.string()).optional(),
  type: z.enum(["SIMPLE", "VARIABLE"]).optional(),
  attributes: z.any().optional(),
  variants: z.array(variantSchema).optional(),
  vatType: z.enum(["INCLUDED", "EXCLUDED"]).optional(),
  vatPercentage: z.coerce.number().nonnegative().optional(),
  freeShipping: z.coerce.boolean().optional(),
  highlights: z.array(z.enum(["NEW_ARRIVAL", "TRENDING", "TOP_SELLING", "OUR_SERVICE"])).optional(),
});
