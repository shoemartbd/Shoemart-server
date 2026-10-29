import z from "zod";

export const updatePageContentZodSchema = z.object({
  title: z.string().min(1, "title is required"),
  content: z.string(),
});
