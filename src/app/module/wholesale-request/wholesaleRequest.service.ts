import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { WholesaleRequestStatus } from "../../../generated/prisma/enums";
import { normalizePhone } from "../blocked-phone/blockedPhone.service";

export interface ICreateWholesaleRequest {
  name: string;
  phone: string;
  email?: string;
  businessName?: string;
  businessType?: string;
  location?: string;
  categories?: string[];
  quantity?: string;
  message?: string;
}

const optional = (value?: string) => value?.trim() || null;

// From the public landing page form
const createRequest = async (payload: ICreateWholesaleRequest) => {
  const phone = normalizePhone(payload.phone);
  if (!/^01\d{9}$/.test(phone)) {
    throw new AppError(status.BAD_REQUEST, "Enter a valid 11-digit mobile number (01XXXXXXXXX)");
  }

  return prisma.wholesaleRequest.create({
    data: {
      name: payload.name.trim(),
      phone,
      email: optional(payload.email),
      businessName: optional(payload.businessName),
      businessType: optional(payload.businessType),
      location: optional(payload.location),
      categories: (payload.categories ?? []).map((c) => c.trim()).filter(Boolean),
      quantity: optional(payload.quantity),
      message: optional(payload.message),
    },
  });
};

const getRequests = async (query: { status?: string; searchTerm?: string }) => {
  const term = query.searchTerm?.trim();
  const statusFilter = Object.values(WholesaleRequestStatus).includes(
    query.status as WholesaleRequestStatus,
  )
    ? (query.status as WholesaleRequestStatus)
    : undefined;

  const [data, counts] = await Promise.all([
    prisma.wholesaleRequest.findMany({
      where: {
        ...(statusFilter && { status: statusFilter }),
        ...(term && {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { phone: { contains: normalizePhone(term) || term } },
            { businessName: { contains: term, mode: "insensitive" } },
            { location: { contains: term, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.wholesaleRequest.groupBy({ by: ["status"], _count: true }),
  ]);

  // Per-status totals for the filter tabs
  const summary = Object.fromEntries(
    Object.values(WholesaleRequestStatus).map((s) => [
      s,
      counts.find((c) => c.status === s)?._count ?? 0,
    ]),
  );

  return { data, summary };
};

const updateRequest = async (
  id: string,
  payload: { status?: WholesaleRequestStatus; adminNote?: string },
) => {
  const existing = await prisma.wholesaleRequest.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Wholesale request not found");

  return prisma.wholesaleRequest.update({
    where: { id },
    data: {
      ...(payload.status && { status: payload.status }),
      ...(payload.adminNote !== undefined && { adminNote: optional(payload.adminNote) }),
    },
  });
};

const deleteRequest = async (id: string) => {
  const existing = await prisma.wholesaleRequest.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Wholesale request not found");
  await prisma.wholesaleRequest.delete({ where: { id } });
  return { id };
};

export const WholesaleRequestService = {
  createRequest,
  getRequests,
  updateRequest,
  deleteRequest,
};
