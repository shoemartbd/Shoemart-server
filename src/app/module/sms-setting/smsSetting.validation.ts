import { z } from "zod";

export const updateSmsSettingZodSchema = z.object({
  enabled: z.boolean().optional(),
  apiKey: z.string().optional().nullable(),
  senderId: z.string().optional().nullable(),
});
