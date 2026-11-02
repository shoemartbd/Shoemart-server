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

const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

// Admins paste either the whole <iframe ...> code from Google Maps "Embed a
// map" or just its src. Only a Google Maps embed src is kept, so no other
// markup ever reaches the page.
const parseMapEmbed = (value: unknown) => {
  const text = parseText(value);
  if (text === undefined || text === null) return text;

  const src = text.match(/src\s*=\s*["']([^"']+)["']/i)?.[1] ?? text;
  const url = src.replace(/&amp;/g, "&").trim();

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError(status.BAD_REQUEST, "Invalid Google Map embed code");
  }
  const isGoogleMaps =
    parsed.protocol === "https:" &&
    (/^(www\.)?google\.[a-z.]+$/.test(parsed.hostname) ||
      parsed.hostname === "maps.google.com") &&
    parsed.pathname.startsWith("/maps/embed");
  if (!isGoogleMaps) {
    throw new AppError(
      status.BAD_REQUEST,
      "Paste the embed code from Google Maps (Share → Embed a map)",
    );
  }
  return parsed.toString();
};

const parseDirectionUrl = (value: unknown) => {
  const text = parseText(value);
  if (text && !isHttpsUrl(text)) {
    throw new AppError(status.BAD_REQUEST, "Direction link must be an https:// URL");
  }
  return text;
};

const orderBy = [{ order: "asc" as const }, { createdAt: "asc" as const }];

const createStore = async (req: Request) => {
  const body = req.body ?? {};
  const file = req.file as Express.Multer.File | undefined;
  const name = parseText(body.name);
  const city = parseText(body.city);
  const address = parseText(body.address);

  if (!name) throw new AppError(status.BAD_REQUEST, "Store name is required");
  if (!city) throw new AppError(status.BAD_REQUEST, "City / location is required");
  if (!address) throw new AppError(status.BAD_REQUEST, "Address is required");

  return prisma.store.create({
    data: {
      name,
      city,
      address,
      openingHours: parseText(body.openingHours),
      mapEmbedUrl: parseMapEmbed(body.mapEmbed),
      directionUrl: parseDirectionUrl(body.directionUrl),
      order: parseOrder(body.order) ?? 0,
      isActive: parseBoolean(body.isActive) ?? true,
      image: file?.path ?? null,
    },
  });
};

// Public list shows only active stores; admins pass ?all=true to see every one
const getStores = async (includeInactive: boolean) => {
  return prisma.store.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy,
  });
};

const updateStore = async (id: string, req: Request) => {
  const existing = await prisma.store.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Store not found");

  const body = req.body ?? {};
  const file = req.file as Express.Multer.File | undefined;
  const name = parseText(body.name);
  const city = parseText(body.city);
  const address = parseText(body.address);

  return prisma.store.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(city && { city }),
      ...(address && { address }),
      openingHours: parseText(body.openingHours),
      mapEmbedUrl: parseMapEmbed(body.mapEmbed),
      directionUrl: parseDirectionUrl(body.directionUrl),
      order: parseOrder(body.order),
      isActive: parseBoolean(body.isActive),
      ...(file
        ? { image: file.path }
        : parseBoolean(body.removeImage)
          ? { image: null }
          : {}),
    },
  });
};

const deleteStore = async (id: string) => {
  const existing = await prisma.store.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Store not found");
  return prisma.store.delete({ where: { id } });
};

export const StoreService = {
  createStore: invalidates(["stores"], createStore),
  getStores: cached("stores", 5 * MINUTE, getStores),
  updateStore: invalidates(["stores"], updateStore),
  deleteStore: invalidates(["stores"], deleteStore),
};
