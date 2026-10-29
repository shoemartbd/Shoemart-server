import z from "zod";

export const homeCategorySectionItemZodSchema = z.object({
  categoryId: z.string().min(1, "categoryId is required"),
  displayType: z.enum(["BEST_SELLING", "LATEST"]),
});

export const updateHomeCategorySectionsZodSchema = z.object({
  sections: z.array(homeCategorySectionItemZodSchema),
});
