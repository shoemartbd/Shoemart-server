import { z } from "zod";

export const updateCodSettingZodSchema = z.object({
  codEnabled: z.boolean().optional(),
});

export const updateSslcommerzSettingZodSchema = z.object({
  sslcommerzEnabled: z.boolean().optional(),
  sslcommerzMode: z.enum(["SANDBOX", "LIVE"]).optional(),
  sslcommerzStoreId: z.string().optional().nullable(),
  sslcommerzStorePassword: z.string().optional().nullable(),
});

export const updateBkashSettingZodSchema = z.object({
  bkashEnabled: z.boolean().optional(),
  bkashMode: z.enum(["SANDBOX", "LIVE"]).optional(),
  bkashAppKey: z.string().trim().optional().nullable(),
  bkashAppSecret: z.string().trim().optional().nullable(),
  bkashUsername: z.string().trim().optional().nullable(),
  bkashPassword: z.string().trim().optional().nullable(),
});
