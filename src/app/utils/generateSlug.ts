import { PrismaClient } from "../../generated/prisma/client";

type SlugModel = "product" | "category" | "landingPage" | "blog";

/**
 * Converts a string into a URL-friendly slug.
 * e.g. "iPhone 15 Pro Max!" → "iphone-15-pro-max"
 *
 * Uses Unicode letter/number categories (not \w, which is ASCII-only) so
 * non-Latin scripts like Bengali survive instead of being stripped to "".
 */
export const toSlug = (text: string): string => {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, "") // remove special characters (Unicode-aware; \p{M} keeps combining marks like Bengali vowel signs)
    .replace(/[\s_]+/g, "-") // spaces/underscores → hyphens
    .replace(/--+/g, "-") // collapse multiple hyphens
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens

  // Fallback for titles with no letters/numbers at all (e.g. pure emoji/symbols)
  return slug || `item-${Date.now().toString(36)}`;
};

/**
 * Generates a unique slug for a given model by checking the database.
 * If "iphone-case" exists, returns "iphone-case-2", then "iphone-case-3", etc.
 *
 * @param prisma  - Prisma client instance (supports transactions too)
 * @param name    - The source string (e.g. product name)
 * @param model   - Which model to check for uniqueness ("product" | "category")
 * @param excludeId - Optional: current record's id to exclude during update operations
 */
export const generateUniqueSlug = async (
  prisma: Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  name: string,
  model: SlugModel,
  excludeId?: string,
): Promise<string> => {
  const baseSlug = toSlug(name);
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    let existing: { id: string } | null = null;

    if (model === "product") {
      existing = await prisma.product.findUnique({
        where: { slug },
        select: { id: true },
      });
    } else if (model === "category") {
      existing = await prisma.category.findUnique({
        where: { slug },
        select: { id: true },
      });
    } else if (model === "landingPage") {
      existing = await prisma.landingPage.findUnique({
        where: { slug },
        select: { id: true },
      });
    } else if (model === "blog") {
      existing = await prisma.blog.findUnique({
        where: { slug },
        select: { id: true },
      });
    }

    // No conflict found → slug is unique
    if (!existing) break;

    // Conflict is the same record being updated → slug is still valid
    if (excludeId && existing.id === excludeId) break;

    // Conflict with another record → try next suffix
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};
