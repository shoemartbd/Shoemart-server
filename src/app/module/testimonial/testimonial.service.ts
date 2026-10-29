import { Request } from "express";
import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { cached, invalidates, MINUTE } from "../../utils/memoryCache";

const parseBoolean = (value: unknown) =>
  value === undefined ? undefined : value === true || value === "true";

// Text fields: undefined = leave as is, "" = clear
const parseText = (value: unknown) =>
  typeof value === "string" ? value.trim() || null : undefined;

// 1–5 stars; anything else falls back to undefined (leave as is / default)
const parseRating = (value: unknown) => {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5
    ? rating
    : undefined;
};

// Display position, lower first; blank/invalid = leave as is / default
const parseOrder = (value: unknown) =>
  value === undefined || value === "" || !Number.isInteger(Number(value))
    ? undefined
    : Number(value);

const orderBy = [{ order: "asc" as const }, { createdAt: "desc" as const }];

const createTestimonial = async (req: Request) => {
  const body = req.body ?? {};
  const file = req.file as Express.Multer.File | undefined;
  const name = parseText(body.name);
  const content = parseText(body.content);

  if (!name) throw new AppError(status.BAD_REQUEST, "Name is required");
  if (!content) throw new AppError(status.BAD_REQUEST, "Review text is required");

  return prisma.testimonial.create({
    data: {
      name,
      content,
      role: parseText(body.role),
      rating: parseRating(body.rating) ?? 5,
      order: parseOrder(body.order) ?? 0,
      isActive: parseBoolean(body.isActive) ?? true,
      avatar: file?.path ?? null,
    },
  });
};

// Public list shows only active ones; admins pass ?all=true to see every one
const getTestimonials = async (includeInactive: boolean) => {
  return prisma.testimonial.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy,
  });
};

const updateTestimonial = async (id: string, req: Request) => {
  const existing = await prisma.testimonial.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Testimonial not found");

  const body = req.body ?? {};
  const file = req.file as Express.Multer.File | undefined;
  const name = parseText(body.name);
  const content = parseText(body.content);

  return prisma.testimonial.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(content && { content }),
      role: parseText(body.role),
      rating: parseRating(body.rating),
      order: parseOrder(body.order),
      isActive: parseBoolean(body.isActive),
      ...(file
        ? { avatar: file.path }
        : parseBoolean(body.removeAvatar)
          ? { avatar: null }
          : {}),
    },
  });
};

const deleteTestimonial = async (id: string) => {
  const existing = await prisma.testimonial.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Testimonial not found");
  return prisma.testimonial.delete({ where: { id } });
};

export const TestimonialService = {
  createTestimonial: invalidates(["testimonials"], createTestimonial),
  getTestimonials: cached("testimonials", 5 * MINUTE, getTestimonials),
  updateTestimonial: invalidates(["testimonials"], updateTestimonial),
  deleteTestimonial: invalidates(["testimonials"], deleteTestimonial),
};
