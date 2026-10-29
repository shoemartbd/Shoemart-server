import z from "zod";

export const createReviewZodSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  rating: z.number().int().min(1).max(5, "Rating must be between 1 and 5"),
  comment: z.string().min(1, "Comment is required"),
});

export const updateReviewZodSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().min(1).optional(),
});
