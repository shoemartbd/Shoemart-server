import z from "zod";

export const addToCartZodSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  productVariantId: z.string().uuid("Invalid product variant ID").optional().nullable(),
  quantity: z.number().int().positive("Quantity must be at least 1"),
});

export const updateCartItemZodSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  productVariantId: z.string().uuid("Invalid product variant ID").optional().nullable(),
  quantity: z.number().int().nonnegative("Quantity cannot be negative"),
});
