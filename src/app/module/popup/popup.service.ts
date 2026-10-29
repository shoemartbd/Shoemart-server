import { Request } from "express";
import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { cached, invalidates, MINUTE } from "../../utils/memoryCache";

const MAX_DELAY_SECONDS = 60;

const parseBoolean = (value: unknown) =>
  value === undefined ? undefined : value === true || value === "true";

// Text fields: undefined = leave as is, "" = clear
const parseText = (value: unknown) =>
  typeof value === "string" ? value.trim() || null : undefined;

// 0–60 seconds; blank = leave as is / default
const parseDelay = (value: unknown) => {
  if (value === undefined || value === "") return undefined;
  const delay = Number(value);
  if (!Number.isInteger(delay) || delay < 0 || delay > MAX_DELAY_SECONDS) {
    throw new AppError(
      status.BAD_REQUEST,
      `Delay must be a whole number between 0 and ${MAX_DELAY_SECONDS} seconds`,
    );
  }
  return delay;
};

// A full URL or a path on this site (e.g. /products?categoryId=…)
const parseLink = (value: unknown) => {
  const link = parseText(value);
  if (link && !/^(https?:\/\/|\/)/i.test(link)) {
    throw new AppError(
      status.BAD_REQUEST,
      "Link must start with http://, https:// or /",
    );
  }
  return link;
};

const createPopup = async (req: Request) => {
  const body = req.body ?? {};
  const file = req.file as Express.Multer.File | undefined;
  if (!file) throw new AppError(status.BAD_REQUEST, "Popup image is required");

  const isActive = parseBoolean(body.isActive) ?? true;
  const data = {
    title: parseText(body.title),
    image: file.path,
    link: parseLink(body.link),
    delaySeconds: parseDelay(body.delaySeconds) ?? 3,
    isActive,
  };

  return prisma.$transaction(async (tx) => {
    // Only one popup is live at a time
    if (isActive) {
      await tx.popup.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }
    return tx.popup.create({ data });
  });
};

const getPopups = async () => {
  return prisma.popup.findMany({ orderBy: { createdAt: "desc" } });
};

// The live popup for the storefront, or null
const getActivePopup = async () => {
  return prisma.popup.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      image: true,
      link: true,
      delaySeconds: true,
      updatedAt: true,
    },
  });
};

const updatePopup = async (id: string, req: Request) => {
  const existing = await prisma.popup.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Popup not found");

  const body = req.body ?? {};
  const file = req.file as Express.Multer.File | undefined;
  const isActive = parseBoolean(body.isActive);
  const data = {
    title: parseText(body.title),
    link: parseLink(body.link),
    delaySeconds: parseDelay(body.delaySeconds),
    isActive,
    ...(file && { image: file.path }),
  };

  return prisma.$transaction(async (tx) => {
    if (isActive) {
      await tx.popup.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      });
    }
    return tx.popup.update({ where: { id }, data });
  });
};

const deletePopup = async (id: string) => {
  const existing = await prisma.popup.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Popup not found");
  return prisma.popup.delete({ where: { id } });
};

export const PopupService = {
  createPopup: invalidates(["popups"], createPopup),
  getPopups,
  getActivePopup: cached("popups", 5 * MINUTE, getActivePopup),
  updatePopup: invalidates(["popups"], updatePopup),
  deletePopup: invalidates(["popups"], deletePopup),
};
