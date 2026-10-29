import z from "zod";

export const createCouponZodSchema = z.object({
  code: z
    .string()
    .min(3, "Coupon code must be at least 3 characters")
    .max(30, "Coupon code must be at most 30 characters")
    .regex(
      /^[A-Z0-9_-]+$/,
      "Only uppercase letters, numbers, hyphens and underscores allowed"
    ),
  discountType: z.enum(["FLAT", "PERCENTAGE"]),
  discountAmount: z.number().positive("Discount amount must be positive"),
  maxDiscountAmount: z.number().positive().optional(),
  minPurchaseAmount: z.number().min(0).default(0),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
  productIds: z.array(z.string().uuid()).min(1, "At least one product required"),
});

export const updateCouponZodSchema = z.object({
  isActive: z.boolean().optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
});
