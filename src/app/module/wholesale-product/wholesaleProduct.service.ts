import { Request } from "express";
import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { cached, invalidates, MINUTE } from "../../utils/memoryCache";

// Products for the /wholesale page, managed apart from the shop catalogue.
// Fields: name, category (or subcategory), photos and colours (each colour
// may carry its own photo).

export interface IWholesaleColour {
  name: string;
  image: string | null;
}

const MAX_IMAGES = 8;
const MAX_COLOURS = 30;

// Code buyers see on the photo, e.g. WP-0007
export const wholesaleCode = (codeNo: number) => `WP-${String(codeNo).padStart(4, "0")}`;

// The stored colours JSON, read defensively
export const readColours = (value: unknown): IWholesaleColour[] =>
  (Array.isArray(value) ? value : []).flatMap((raw) => {
    const c = raw as Partial<IWholesaleColour>;
    const name = typeof c?.name === "string" ? c.name.trim() : "";
    if (!name) return [];
    return [{ name, image: typeof c.image === "string" && c.image ? c.image : null }];
  });

// The product's own spelling of a colour, or null when it isn't one of them
export const matchColour = (colours: unknown, wanted?: string | null): string | null => {
  const key = wanted?.trim().toLowerCase();
  if (!key) return null;
  return readColours(colours).find((c) => c.name.toLowerCase() === key)?.name ?? null;
};

// The colour's own photo, else the first product photo
export const imageFor = (p: { images: string[]; colors: unknown }, colour: string | null) =>
  (colour && readColours(p.colors).find((c) => c.name === colour)?.image) || p.images[0] || null;

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (value === undefined || value === "") return fallback;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    throw new AppError(status.BAD_REQUEST, "Invalid form data");
  }
};

const parseBoolean = (value: unknown) =>
  value === undefined ? undefined : value === true || value === "true";

type UploadedFiles = Record<string, Express.Multer.File[] | undefined>;
const filesOf = (req: Request) => (req.files ?? {}) as UploadedFiles;

// Colours come as JSON: [{ name, image?: existing url, upload?: index into
// the "colorImages" files sent with the form }]
const parseColours = (req: Request, previous: IWholesaleColour[] = []) => {
  const raw = parseJson<{ name?: unknown; image?: unknown; upload?: unknown }[]>(
    req.body?.colors,
    [],
  );
  if (!Array.isArray(raw)) throw new AppError(status.BAD_REQUEST, "Invalid colours");
  const uploads = filesOf(req).colorImages ?? [];
  const known = new Set(previous.map((c) => c.image).filter(Boolean));

  const seen = new Set<string>();
  const colours: IWholesaleColour[] = [];
  for (const c of raw) {
    const name = typeof c?.name === "string" ? c.name.trim().slice(0, 60) : "";
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) throw new AppError(status.BAD_REQUEST, `Colour "${name}" is added twice`);
    seen.add(key);

    const upload = Number.isInteger(c.upload) ? uploads[c.upload as number] : undefined;
    // Only keep an existing photo that already belonged to this product
    const kept = typeof c.image === "string" && known.has(c.image) ? c.image : null;
    colours.push({ name, image: upload?.path ?? kept });
  }
  if (colours.length > MAX_COLOURS) {
    throw new AppError(status.BAD_REQUEST, `Up to ${MAX_COLOURS} colours`);
  }
  return colours;
};

// Photos: the existing ones the admin kept (in order) + new uploads
const parseImages = (req: Request, previous: string[] = []) => {
  const keep = parseJson<unknown[]>(req.body?.keepImages, []);
  const kept = (Array.isArray(keep) ? keep : []).filter(
    (url): url is string => typeof url === "string" && previous.includes(url),
  );
  const uploaded = (filesOf(req).images ?? []).map((f) => f.path);
  const images = [...kept, ...uploaded];
  if (images.length === 0) throw new AppError(status.BAD_REQUEST, "Add at least one photo");
  if (images.length > MAX_IMAGES) {
    throw new AppError(status.BAD_REQUEST, `Up to ${MAX_IMAGES} photos`);
  }
  return images;
};

const parseCategory = async (value: unknown) => {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id) throw new AppError(status.BAD_REQUEST, "Category is required");
  const category = await prisma.category.findUnique({ where: { id }, select: { id: true } });
  if (!category) throw new AppError(status.BAD_REQUEST, "Category not found");
  return id;
};

const parseName = (value: unknown) => {
  const name = typeof value === "string" ? value.trim().slice(0, 150) : "";
  if (!name) throw new AppError(status.BAD_REQUEST, "Product name is required");
  return name;
};

const categoryInclude = {
  category: {
    select: {
      id: true,
      name: true,
      image: true,
      parentId: true,
      parent: { select: { id: true, name: true, image: true } },
    },
  },
};

const toAdmin = <T extends { codeNo: number; colors: unknown }>(p: T) => ({
  ...p,
  code: wholesaleCode(p.codeNo),
  colors: readColours(p.colors),
});

const createProduct = async (req: Request) => {
  const body = req.body ?? {};
  const product = await prisma.wholesaleProduct.create({
    data: {
      name: parseName(body.name),
      categoryId: await parseCategory(body.categoryId),
      images: parseImages(req),
      colors: parseColours(req) as object[],
      isActive: parseBoolean(body.isActive) ?? true,
    },
    include: categoryInclude,
  });
  return toAdmin(product);
};

const updateProduct = async (id: string, req: Request) => {
  const existing = await prisma.wholesaleProduct.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Wholesale product not found");
  const body = req.body ?? {};

  const product = await prisma.wholesaleProduct.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: parseName(body.name) }),
      ...(body.categoryId !== undefined && { categoryId: await parseCategory(body.categoryId) }),
      ...((body.keepImages !== undefined || filesOf(req).images) && {
        images: parseImages(req, existing.images),
      }),
      ...(body.colors !== undefined && {
        colors: parseColours(req, readColours(existing.colors)) as object[],
      }),
      ...(parseBoolean(body.isActive) !== undefined && { isActive: parseBoolean(body.isActive) }),
    },
    include: categoryInclude,
  });
  return toAdmin(product);
};

const deleteProduct = async (id: string) => {
  const existing = await prisma.wholesaleProduct.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Wholesale product not found");
  // Requests keep their own copy of name / code / photo, so they still read fine
  await prisma.wholesaleProduct.delete({ where: { id } });
  return { id };
};

// Admin list, newest first; search by name or code (WP-0007 / 7)
const getProducts = async (query: { searchTerm?: string; categoryId?: string }) => {
  const term = query.searchTerm?.trim();
  const codeNo = term ? Number(term.replace(/^wp-?/i, "")) : NaN;
  const products = await prisma.wholesaleProduct.findMany({
    where: {
      ...(query.categoryId && {
        OR: [{ categoryId: query.categoryId }, { category: { parentId: query.categoryId } }],
      }),
      ...(term && {
        AND: [
          {
            OR: [
              { name: { contains: term, mode: "insensitive" as const } },
              ...(Number.isInteger(codeNo) && codeNo > 0 && codeNo < 2 ** 31 ? [{ codeNo }] : []),
            ],
          },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    include: categoryInclude,
  });
  return products.map(toAdmin);
};

// Public: the wholesale page "Product View" (active products, no prices),
// grouped client-side under the top-level category
const getGallery = async () => {
  const products = await prisma.wholesaleProduct.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    include: categoryInclude,
  });
  return products
    .filter((p) => p.images.length > 0)
    .map((p) => {
      const top = p.category.parent ?? p.category;
      const colours = readColours(p.colors);
      return {
        id: p.id,
        name: p.name,
        code: wholesaleCode(p.codeNo),
        image: p.images[0],
        images: p.images,
        categoryId: top.id,
        categoryName: top.name,
        categoryImage: top.image ?? null,
        subcategoryName: p.category.parent ? p.category.name : null,
        colors: colours.map((c) => c.name),
        colorImages: Object.fromEntries(
          colours.filter((c) => c.image).map((c) => [c.name, c.image as string]),
        ),
      };
    });
};

const GALLERY = "wholesale-products-gallery";

export const WholesaleProductService = {
  createProduct: invalidates([GALLERY], createProduct),
  updateProduct: invalidates([GALLERY], updateProduct),
  deleteProduct: invalidates([GALLERY], deleteProduct),
  getProducts,
  getGallery: cached(GALLERY, 5 * MINUTE, getGallery),
};
