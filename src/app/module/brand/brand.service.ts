import { Request } from "express";
import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { cached, invalidates, MINUTE } from "../../utils/memoryCache";

const parseBoolean = (value: unknown) =>
  value === undefined ? undefined : value === true || value === "true";

const createBrand = async (req: Request) => {
  const file = req.file as any;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

  if (!name) throw new AppError(status.BAD_REQUEST, "Brand name is required");
  if (!file) throw new AppError(status.BAD_REQUEST, "Brand logo is required");

  const exists = await prisma.brand.findUnique({ where: { name } });
  if (exists) {
    throw new AppError(status.CONFLICT, `Brand "${name}" already exists`);
  }

  return prisma.brand.create({
    data: {
      name,
      logo: file.path,
      isActive: parseBoolean(req.body?.isActive) ?? true,
    },
  });
};

// Public list shows only active brands; admins pass ?all=true to see every brand
const getBrands = async (includeInactive: boolean) => {
  return prisma.brand.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
};

const updateBrand = async (id: string, req: Request) => {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Brand not found");

  const file = req.file as any;
  const name =
    typeof req.body?.name === "string" && req.body.name.trim()
      ? req.body.name.trim()
      : undefined;

  if (name && name !== existing.name) {
    const clash = await prisma.brand.findUnique({ where: { name } });
    if (clash) {
      throw new AppError(status.CONFLICT, `Brand "${name}" already exists`);
    }
  }

  return prisma.brand.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(file && { logo: file.path }),
      ...(parseBoolean(req.body?.isActive) !== undefined && {
        isActive: parseBoolean(req.body?.isActive),
      }),
    },
  });
};

// Products keep existing; their brand is cleared (onDelete: SetNull)
const deleteBrand = async (id: string) => {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Brand not found");
  return prisma.brand.delete({ where: { id } });
};

export const BrandService = {
  createBrand: invalidates(["brands"], createBrand),
  getBrands: cached("brands", 5 * MINUTE, getBrands),
  updateBrand: invalidates(["brands"], updateBrand),
  deleteBrand: invalidates(["brands"], deleteBrand),
};
