import { z } from "zod";

export const updatePathaoSettingZodSchema = z.object({
  pathaoEnabled: z.boolean().optional(),
  pathaoBaseUrl: z.string().optional().nullable(),
  pathaoClientId: z.string().optional().nullable(),
  pathaoClientSecret: z.string().optional().nullable(),
  pathaoUsername: z.string().optional().nullable(),
  pathaoPassword: z.string().optional().nullable(),
  pathaoStoreId: z.string().optional().nullable(),
});

export const updateSteadfastSettingZodSchema = z.object({
  steadfastEnabled: z.boolean().optional(),
  steadfastApiKey: z.string().optional().nullable(),
  steadfastSecretKey: z.string().optional().nullable(),
  steadfastWebhookAuthToken: z.string().optional().nullable(),
});

export const updateRedxSettingZodSchema = z.object({
  redxEnabled: z.boolean().optional(),
  redxMode: z.enum(["SANDBOX", "LIVE"]).optional(),
  redxAccessToken: z.string().trim().optional().nullable(),
  redxPickupStoreId: z.string().trim().optional().nullable(),
  redxWebhookToken: z.string().trim().optional().nullable(),
});
