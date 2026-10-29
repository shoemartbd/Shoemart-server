import { Request } from "express";
import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";

const readName = (req: Request) =>
  typeof req.body?.name === "string" ? req.body.name.trim() : "";

const assertNameFree = async (name: string, exceptId?: string) => {
  const clash = await prisma.sizeChart.findUnique({ where: { name } });
  if (clash && clash.id !== exceptId) {
    throw new AppError(status.CONFLICT, `Size chart "${name}" already exists`);
  }
};

const createSizeChart = async (req: Request) => {
  const file = req.file as Express.Multer.File | undefined;
  const name = readName(req);

  if (!name) throw new AppError(status.BAD_REQUEST, "Size chart name is required");
  if (!file) throw new AppError(status.BAD_REQUEST, "Size chart image is required");
  await assertNameFree(name);

  return prisma.sizeChart.create({ data: { name, image: file.path } });
};

const getSizeCharts = async () => {
  return prisma.sizeChart.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
};

const updateSizeChart = async (id: string, req: Request) => {
  const existing = await prisma.sizeChart.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Size chart not found");

  const file = req.file as Express.Multer.File | undefined;
  const name = readName(req);
  if (name && name !== existing.name) await assertNameFree(name, id);

  return prisma.sizeChart.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(file && { image: file.path }),
    },
  });
};

// Products keep existing; their size chart is cleared (onDelete: SetNull)
const deleteSizeChart = async (id: string) => {
  const existing = await prisma.sizeChart.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Size chart not found");
  return prisma.sizeChart.delete({ where: { id } });
};

export const SizeChartService = {
  createSizeChart,
  getSizeCharts,
  updateSizeChart,
  deleteSizeChart,
};
