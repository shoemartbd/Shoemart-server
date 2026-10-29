import { z } from "zod";

// "" clears an optional field
export const updateGtmSettingZodSchema = z.object({
  isEnabled: z.boolean().optional(),
  containerId: z
    .union([
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^GTM-[A-Z0-9]{4,12}$/, "Container ID looks like GTM-XXXXXXX"),
      z.literal(""),
    ])
    .optional(),
  scriptDomain: z
    .union([
      z
        .url("Enter a full URL, e.g. https://sgtm.example.com")
        .refine((v) => v.startsWith("https://"), "The domain must use https://"),
      z.literal(""),
    ])
    .optional(),
});
