import z from "zod";

export const createBlogZodSchema = z.object({
  title: z.string().min(1, "Title is required"),
  excerpt: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  author: z.string().optional(),
  isPublished: z.boolean().optional().default(false),
});

export const updateBlogZodSchema = z.object({
  title: z.string().min(1).optional(),
  excerpt: z.string().optional(),
  content: z.string().min(1).optional(),
  author: z.string().optional(),
  isPublished: z.boolean().optional(),
  removeCoverImage: z.boolean().optional(),
});
