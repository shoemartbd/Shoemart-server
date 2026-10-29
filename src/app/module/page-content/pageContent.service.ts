import { prisma } from "../../lib/prisma";

const defaultTitles: Record<string, string> = {
  "about-us": "About Us",
  "terms-and-conditions": "Terms and Conditions",
  "privacy-policy": "Privacy Policy",
  "refund-policy": "Refund Policy",
};

const titleCaseFromSlug = (slug: string) =>
  slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const pageContentSelect = {
  slug: true,
  title: true,
  content: true,
  updatedAt: true,
};

const getPageContent = async (slug: string) => {
  let page = await prisma.pageContent.findUnique({
    where: { slug },
    select: pageContentSelect,
  });

  if (!page) {
    page = await prisma.pageContent.create({
      data: {
        slug,
        title: defaultTitles[slug] ?? titleCaseFromSlug(slug),
        content: "",
      },
      select: pageContentSelect,
    });
  }

  return page;
};

const upsertPageContent = async (
  slug: string,
  payload: { title: string; content: string },
) => {
  const page = await prisma.pageContent.upsert({
    where: { slug },
    update: payload,
    create: { slug, ...payload },
    select: pageContentSelect,
  });

  return page;
};

export const PageContentService = {
  getPageContent,
  upsertPageContent,
};
