import z from "zod";

export const faqItemZodSchema = z.object({
  question: z.string().min(1, "question is required"),
  answer: z.string().min(1, "answer is required"),
  isActive: z.boolean(),
});

export const updateFaqsZodSchema = z.object({
  faqs: z.array(faqItemZodSchema),
});
