import { prisma } from "../../lib/prisma";
import { cached, invalidates, MINUTE } from "../../utils/memoryCache";

const faqSelect = {
  id: true,
  question: true,
  answer: true,
  order: true,
  isActive: true,
};

const getFaqs = async () => {
  const faqs = await prisma.faq.findMany({
    orderBy: { order: "asc" },
    select: faqSelect,
  });

  return faqs;
};

const getPublicFaqs = async () => {
  const faqs = await prisma.faq.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: faqSelect,
  });

  return faqs;
};

const replaceFaqs = async (
  faqs: { question: string; answer: string; isActive: boolean }[],
) => {
  await prisma.$transaction([
    prisma.faq.deleteMany({}),
    prisma.faq.createMany({
      data: faqs.map((faq, index) => ({
        question: faq.question,
        answer: faq.answer,
        isActive: faq.isActive,
        order: index,
      })),
    }),
  ]);

  return getFaqs();
};

export const FaqService = {
  getFaqs,
  getPublicFaqs: cached("faqs", 5 * MINUTE, getPublicFaqs),
  replaceFaqs: invalidates(["faqs"], replaceFaqs),
};
