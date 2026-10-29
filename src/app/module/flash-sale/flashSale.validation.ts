import z from "zod";

export const updateFlashSaleZodSchema = z.object({
  isActive: z.boolean(),
  startTime: z.string().datetime({ offset: true }).nullable(),
  endTime: z.string().datetime({ offset: true }).nullable(),
  productIds: z.array(z.string()),
});
