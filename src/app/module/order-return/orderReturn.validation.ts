import z from "zod";

export const processOrderReturnZodSchema = z.object({
  orderId: z.string().uuid(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, "At least one item must be selected for return"),
});
