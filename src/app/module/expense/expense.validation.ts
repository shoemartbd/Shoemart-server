import z from "zod";

export const createExpenseCategoryZodSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});

export const updateExpenseCategoryZodSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  isActive: z.boolean().optional(),
});

export const createExpenseZodSchema = z.object({
  categoryId: z.string().uuid("Invalid expense category"),
  name: z.string().min(1, "Name is required").max(150),
  price: z.number().positive("Price must be positive"),
  note: z.string().max(500).optional(),
  date: z.string().min(1, "Date is required"),
});

export const updateExpenseZodSchema = z.object({
  categoryId: z.string().uuid("Invalid expense category").optional(),
  name: z.string().min(1, "Name is required").max(150).optional(),
  price: z.number().positive("Price must be positive").optional(),
  note: z.string().max(500).optional(),
  date: z.string().min(1).optional(),
});
