import z from "zod";

export const createAttributeZodSchema = z.object({
  name: z.string().min(1, "Attribute name is required"),
});

export const updateAttributeZodSchema = z.object({
  name: z.string().min(1, "Attribute name is required"),
});

export const addAttributeValueZodSchema = z.object({
  value: z.string().min(1, "Attribute value is required"),
});
