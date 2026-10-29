import { prisma } from "../../lib/prisma";
import { Prisma } from "../../../generated/prisma/client";
import { CheckoutSource } from "../../../generated/prisma/enums";
import { IQueryParams } from "../../interfaces/query.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";

type TrackAbandonedCheckoutPayload = {
  sessionToken: string;
  source?: CheckoutSource;
  landingPageSlug?: string | null;
  fullName?: string | null;
  phone?: string | null;
  address?: string | null;
  district?: string | null;
  notes?: string | null;
  items?: unknown[];
  subtotal?: number;
  shippingFee?: number;
  discountAmount?: number;
  total?: number;
};

// Only keep keys that were actually sent — a partial snapshot (eg. just the
// name field after one blur) must never blank out fields saved earlier.
const pickDefined = <T extends Record<string, unknown>>(obj: T) => {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
};

const trackCheckout = async (payload: TrackAbandonedCheckoutPayload) => {
  const { sessionToken, ...rest } = payload;
  // Plain scalar fields only (no relations) — safe to reuse the same object
  // shape for both the create and update branches of the upsert.
  const data = pickDefined(rest) as Record<string, unknown>;

  return prisma.abandonedCheckout.upsert({
    where: { sessionToken },
    create: {
      sessionToken,
      source: payload.source || CheckoutSource.STOREFRONT,
      items: (payload.items ?? []) as Prisma.InputJsonValue,
      ...data,
    } as Prisma.AbandonedCheckoutCreateInput,
    update: data as Prisma.AbandonedCheckoutUpdateInput,
  });
};

const getAbandonedCheckouts = async (queryParams: IQueryParams) => {
  const query = new QueryBuilder(prisma.abandonedCheckout, queryParams, {
    searchableFields: ["fullName", "phone", "address"],
  })
    .search()
    .filter()
    .sort()
    .paginate();

  return query.execute();
};

const deleteAbandonedCheckout = async (id: string) => {
  return prisma.abandonedCheckout.delete({ where: { id } });
};

// Best-effort — called after a real order is placed so the abandoned record
// (if any) for that browser session disappears. Never throws.
const deleteBySessionToken = async (sessionToken: string) => {
  try {
    await prisma.abandonedCheckout.deleteMany({ where: { sessionToken } });
  } catch {
    // ignore — cleanup is not critical to order placement succeeding
  }
};

export const AbandonedCheckoutService = {
  trackCheckout,
  getAbandonedCheckouts,
  deleteAbandonedCheckout,
  deleteBySessionToken,
};
