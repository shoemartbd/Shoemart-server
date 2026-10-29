import { z } from "zod";
import { bdMobilePhoneSchema } from "../../utils/bdPhone";

export const addToPosCartZodSchema = z.object({
  productId: z.string({ message: "Product ID is required" }).min(1, "Product ID is required"),
  productVariantId: z.string().optional().nullable(),
  productName: z.string({ message: "Product Name is required" }).min(1, "Product Name is required"),
  price: z.number({ message: "Price is required" }).min(0),
  quantity: z.number().int().min(1).default(1),
  combination: z.string().optional().nullable(),
  productImage: z.string().optional().nullable(),
});

export const updatePosCartItemZodSchema = z.object({
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

export const createPosOrderZodSchema = z.object({
  subtotal: z.number(),
  discount: z.number().default(0),
  tax: z.number().min(0).default(0),
  shippingCharge: z.number().min(0).default(0),
  total: z.number(),
  coupon: z.string().optional().nullable(),
  customer: z.object({
    name: z.string().optional().nullable(),
    companyName: z.string().trim().max(200).optional().nullable(),
    phone: bdMobilePhoneSchema,
    address: z.string().optional().nullable(),
    district: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
  }),
  payment: z.object({
    method: z.string().default("Cash"),
    amount: z.number().default(0),
    change: z.number().default(0),
  }),
});
