import status from "http-status";
import { prisma } from "../../lib/prisma";
import { IQueryParams } from "../../interfaces/query.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import AppError from "../../errorHelpers/AppError";
import { generateUniqueSlug } from "../../utils/generateSlug";
import { deleteFileFromCloudinary } from "../../config/cloudinary.config";

const createBlog = async (payload: {
  title: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  author?: string;
  isPublished?: boolean;
}) => {
  const slug = await generateUniqueSlug(prisma, payload.title, "blog");

  const blog = await prisma.blog.create({
    data: { ...payload, slug },
  });

  return blog;
};

const getAllBlogs = async (queryParams: IQueryParams) => {
  const result = await new QueryBuilder(prisma.blog, queryParams, {
    searchableFields: ["title"],
  })
    .search()
    .filter()
    .where({ isPublished: true })
    .sort()
    .paginate()
    .execute();

  return result;
};

const getAllBlogsAdmin = async (queryParams: IQueryParams) => {
  const result = await new QueryBuilder(prisma.blog, queryParams, {
    searchableFields: ["title"],
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .execute();

  return result;
};

const getBlogById = async (id: string) => {
  const blog = await prisma.blog.findUnique({ where: { id } });

  if (!blog) {
    throw new AppError(status.NOT_FOUND, "Blog not found");
  }

  return blog;
};

const getBlogBySlug = async (slug: string) => {
  const blog = await prisma.blog.findUnique({ where: { slug } });

  if (!blog || !blog.isPublished) {
    throw new AppError(status.NOT_FOUND, "Blog not found");
  }

  return blog;
};

const updateBlog = async (
  id: string,
  payload: {
    title?: string;
    excerpt?: string;
    content?: string;
    coverImage?: string;
    author?: string;
    isPublished?: boolean;
    removeCoverImage?: boolean;
  },
) => {
  const existing = await prisma.blog.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(status.NOT_FOUND, "Blog not found");
  }

  let slug: string | undefined;
  if (payload.title && payload.title !== existing.title) {
    slug = await generateUniqueSlug(prisma, payload.title, "blog", id);
  }

  const { removeCoverImage, ...rest } = payload;

  let coverImage: string | null | undefined = rest.coverImage;
  if (rest.coverImage && existing.coverImage) {
    await deleteFileFromCloudinary(existing.coverImage);
  } else if (removeCoverImage && existing.coverImage && !rest.coverImage) {
    await deleteFileFromCloudinary(existing.coverImage);
    coverImage = null;
  }

  const updated = await prisma.blog.update({
    where: { id },
    data: { ...rest, coverImage, ...(slug && { slug }) },
  });

  return updated;
};

const deleteBlog = async (id: string) => {
  const existing = await prisma.blog.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError(status.NOT_FOUND, "Blog not found");
  }

  await prisma.blog.delete({ where: { id } });

  if (existing.coverImage) {
    await deleteFileFromCloudinary(existing.coverImage);
  }

  return { message: "Blog deleted successfully" };
};

export const BlogService = {
  createBlog,
  getAllBlogs,
  getAllBlogsAdmin,
  getBlogById,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
};
