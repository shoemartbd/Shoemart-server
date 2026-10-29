import status from "http-status";
import { prisma } from "../../lib/prisma";
import { IQueryParams } from "../../interfaces/query.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import AppError from "../../errorHelpers/AppError";
import { generateUniqueSlug } from "../../utils/generateSlug";
import { cached, invalidates, MINUTE } from "../../utils/memoryCache";

const createCategory = async (payload: {
  name: string;
  icon?: string;
  image?: string;
  parentId?: string;
}) => {
  // If parentId given, verify parent exists
  if (payload.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: payload.parentId },
    });
    if (!parent) {
      throw new AppError(status.NOT_FOUND, "Parent category not found");
    }
  }

  const slug = await generateUniqueSlug(prisma, payload.name, "category");

  const category = await prisma.category.create({
    data: { ...payload, slug },
    include: { parent: true, subcategories: true },
  });

  return category;
};

const getAllCategories = async (queryParams: IQueryParams) => {
  const result = await new QueryBuilder(prisma.category, queryParams, {
    searchableFields: ["name", "slug"],
    filterableFields: ["isActive", "parentId"],
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .include({ parent: true, subcategories: true })
    .execute();

  return result;
};

const getAllSubcategories = async (
  parentId: string,
  queryParams: IQueryParams,
) => {
  const parent = await prisma.category.findUnique({ where: { id: parentId } });
  if (!parent) {
    throw new AppError(status.NOT_FOUND, "Parent category not found");
  }

  const result = await new QueryBuilder(prisma.category, queryParams, {
    searchableFields: ["name", "slug"],
  })
    .search()
    .filter()
    .where({ parentId })
    .sort()
    .paginate()
    .execute();

  return result;
};

const getCategoryById = async (id: string) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { parent: true, subcategories: true },
  });

  if (!category) {
    throw new AppError(status.NOT_FOUND, "Category not found");
  }

  return category;
};

const updateCategory = async (
  id: string,
  payload: {
    name?: string;
    icon?: string;
    image?: string;
    isActive?: boolean;
    parentId?: string;
  },
) => {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(status.NOT_FOUND, "Category not found");
  }

  let slug: string | undefined;
  if (payload.name && payload.name !== existing.name) {
    slug = await generateUniqueSlug(prisma, payload.name, "category", id);
  }

  const updated = await prisma.category.update({
    where: { id },
    data: { ...payload, ...(slug && { slug }) },
    include: { parent: true, subcategories: true },
  });

  return updated;
};

const deleteCategory = async (id: string) => {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { subcategories: true, products: { take: 1 } },
  });

  if (!existing) {
    throw new AppError(status.NOT_FOUND, "Category not found");
  }

  if (existing.products.length > 0) {
    throw new AppError(
      status.BAD_REQUEST,
      "Cannot delete category with associated products",
    );
  }

  if (existing.subcategories.length > 0) {
    throw new AppError(
      status.BAD_REQUEST,
      "Cannot delete category that has subcategories. Delete subcategories first.",
    );
  }

  await prisma.category.delete({ where: { id } });
  return { message: "Category deleted successfully" };
};

// Category menus load on every page; homepage sections show category names
const CATEGORY = ["categories", "subcategories", "home-sections"];

export const CategoryService = {
  createCategory: invalidates(CATEGORY, createCategory),
  getAllCategories: cached("categories", 5 * MINUTE, getAllCategories),
  getAllSubcategories: cached("subcategories", 5 * MINUTE, getAllSubcategories),
  getCategoryById,
  updateCategory: invalidates(CATEGORY, updateCategory),
  deleteCategory: invalidates(CATEGORY, deleteCategory),
};
