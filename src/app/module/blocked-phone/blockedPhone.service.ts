import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser";

// "+880 1712-345678", "8801712345678" and "01712345678" are the same number
export const normalizePhone = (raw: string) => {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("880")) digits = digits.slice(2);
  else if (digits.startsWith("88") && digits.length === 13) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("1")) digits = `0${digits}`;
  return digits;
};

export const BLOCKED_PHONE_MESSAGE =
  "Orders can't be placed with this phone number. Please contact us if you think this is a mistake.";

// Called before every storefront / landing page order
const assertPhoneAllowed = async (phone: string) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return;
  const blocked = await prisma.blockedPhone.findUnique({ where: { phone: normalized } });
  if (blocked) throw new AppError(status.FORBIDDEN, BLOCKED_PHONE_MESSAGE);
};

// Which of these numbers are blocked (for badges on the order list)
const findBlocked = async (phones: (string | null | undefined)[]) => {
  const normalized = Array.from(
    new Set(phones.filter(Boolean).map((p) => normalizePhone(p as string))),
  );
  if (normalized.length === 0) return new Set<string>();
  const rows = await prisma.blockedPhone.findMany({
    where: { phone: { in: normalized } },
    select: { phone: true },
  });
  return new Set(rows.map((r) => r.phone));
};

const getBlockedPhones = async (searchTerm?: string) => {
  const term = searchTerm?.trim();
  return prisma.blockedPhone.findMany({
    where: term
      ? {
          OR: [
            { phone: { contains: normalizePhone(term) || term } },
            { reason: { contains: term, mode: "insensitive" } },
            { orderNumber: { contains: term, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
  });
};

const blockPhone = async (
  payload: { phone?: string; orderId?: string; reason?: string },
  admin: IRequestUser,
) => {
  let phone = payload.phone;
  let orderNumber: string | null = null;

  // Blocking from an order uses that order's number
  if (payload.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: payload.orderId },
      select: { phone: true, orderNumber: true },
    });
    if (!order) throw new AppError(status.NOT_FOUND, "Order not found");
    phone = order.phone ?? undefined;
    orderNumber = order.orderNumber;
  }

  const normalized = normalizePhone(phone ?? "");
  if (!/^01\d{9}$/.test(normalized)) {
    throw new AppError(status.BAD_REQUEST, "Enter a valid 11-digit mobile number (01XXXXXXXXX)");
  }

  const existing = await prisma.blockedPhone.findUnique({ where: { phone: normalized } });
  if (existing) return existing;

  const adminUser = await prisma.user.findUnique({
    where: { id: admin.userId },
    select: { name: true },
  });

  return prisma.blockedPhone.create({
    data: {
      phone: normalized,
      reason: payload.reason?.trim() || null,
      orderNumber,
      blockedById: admin.userId,
      blockedBy: adminUser?.name ?? null,
    },
  });
};

const unblockPhone = async (id: string) => {
  const existing = await prisma.blockedPhone.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "This number is not blocked");
  await prisma.blockedPhone.delete({ where: { id } });
  return { id, phone: existing.phone };
};

export const BlockedPhoneService = {
  assertPhoneAllowed,
  findBlocked,
  getBlockedPhones,
  blockPhone,
  unblockPhone,
};
