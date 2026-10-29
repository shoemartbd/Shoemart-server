import { z } from "zod";

export const createSampleWorkZodSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  description: z.string().trim().max(500).optional().nullable(),
  fileUrl: z.url("Upload the PDF first"),
  publicId: z.string().optional().nullable(),
  fileSize: z.number().int().nonnegative().optional().nullable(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const updateSampleWorkZodSchema = createSampleWorkZodSchema.partial();
