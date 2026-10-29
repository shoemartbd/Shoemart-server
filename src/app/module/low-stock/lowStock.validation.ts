import { z } from "zod";

export const updateStockZodSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  variantId: z.string().uuid("Invalid variant ID").optional().nullable(),
  stock: z.number().int().min(0, "Stock cannot be negative"),
});
