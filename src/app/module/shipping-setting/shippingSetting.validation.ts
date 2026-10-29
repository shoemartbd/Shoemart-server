import { z } from "zod";

export const updateShippingSettingZodSchema = z.object({
  insideDhakaShippingFee: z.number().nonnegative().optional(),
  outsideDhakaShippingFee: z.number().nonnegative().optional(),
});
