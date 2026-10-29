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

// Display position, lower first; blank/invalid = leave as is / default
const parseOrder = (value: unknown) =>
  value === undefined || value === "" || !Number.isInteger(Number(value))
    ? undefined
    : Number(value);

const orderBy = [{ order: "asc" as const }, { createdAt: "asc" as const }];

const createClientLogo = async (req: Request) => {
  const body = req.body ?? {};
  const file = req.file as Express.Multer.File | undefined;
  const name = parseText(body.name);

  if (!name) throw new AppError(status.BAD_REQUEST, "Client name is required");
  if (!file) throw new AppError(status.BAD_REQUEST, "Client logo is required");

  return prisma.clientLogo.create({
    data: {
      name,
      logo: file.path,
      website: parseText(body.website),
      order: parseOrder(body.order) ?? 0,
      isActive: parseBoolean(body.isActive) ?? true,
    },
  });
};

// Public list shows only active ones; admins pass ?all=true to see every one
const getClientLogos = async (includeInactive: boolean) => {
  return prisma.clientLogo.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy,
  });
};

const updateClientLogo = async (id: string, req: Request) => {
  const existing = await prisma.clientLogo.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Client not found");

  const body = req.body ?? {};
  const file = req.file as Express.Multer.File | undefined;
  const name = parseText(body.name);

  return prisma.clientLogo.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(file && { logo: file.path }),
      website: parseText(body.website),
      order: parseOrder(body.order),
      isActive: parseBoolean(body.isActive),
    },
  });
};

const deleteClientLogo = async (id: string) => {
  const existing = await prisma.clientLogo.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Client not found");
  return prisma.clientLogo.delete({ where: { id } });
};

export const ClientLogoService = {
  createClientLogo: invalidates(["client-logos"], createClientLogo),
  getClientLogos: cached("client-logos", 5 * MINUTE, getClientLogos),
  updateClientLogo: invalidates(["client-logos"], updateClientLogo),
  deleteClientLogo: invalidates(["client-logos"], deleteClientLogo),
};
