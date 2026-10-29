import { z } from "zod";

export const createRoleZodSchema = z.object({
  name: z.string().trim().min(1, "Role name is required").max(50),
  permissions: z.array(z.string()).default([]),
});

export const updateRoleZodSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  permissions: z.array(z.string()).optional(),
});

export const createStaffZodSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  staffRoleId: z.string().uuid("Select a role"),
});

export const updateStaffZodSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  staffRoleId: z.string().uuid().optional(),
  status: z.enum(["ACTIVE", "BLOCKED"]).optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
