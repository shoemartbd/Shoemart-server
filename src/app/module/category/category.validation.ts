import z from "zod";

export const createCategoryZodSchema = z.object({
  name: z.string().min(1, "Category name is required"),
  icon: z.string().optional(),
  image: z.string().optional(),
  parentId: z.string().nullable().optional(), // for subcategory
});

export const updateCategoryZodSchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().optional(),
  image: z.string().optional(),
  isActive: z.boolean().optional(),
  parentId: z.string().nullable().optional(),
});
