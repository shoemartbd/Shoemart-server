import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import {
  OrderStatus,
  OrderType,
  PaymentStatus,
} from "../../../generated/prisma/enums";
import { PaymentSettingService } from "../payment-setting/paymentSetting.service";
import { OrderService } from "../order/order.service";
import { backendApiBaseUrl, SslcommerzService } from "./sslcommerz.service";
import { BkashService } from "./bkash.service";

// Who is starting a payment: the signed-in owner of the order, or a guest
// paying for an order placed without an account
type PaymentRequester = { userId: string } | { guest: true };

const assertCanPay = (
  order: { userId: string | null; orderType: OrderType },
  requester: PaymentRequester,
) => {
  if ("guest" in requester) {
    const isGuestOrder =
      !order.userId &&
      (order.orderType === OrderType.ONLINE || order.orderType === OrderType.LANDING_PAGE);
    if (!isGuestOrder) {
      throw new AppError(status.FORBIDDEN, "This order can't be paid here");
    }
  } else if (order.userId !== requester.userId) {
    throw new AppError(status.FORBIDDEN, "This order does not belong to you");
  }
};

const initiateSslcommerzPayment = async (orderId: string, requester: PaymentRequester) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(status.NOT_FOUND, "Order not found");
  assertCanPay(order, requester);
  if (order.paymentStatus === PaymentStatus.PAID) {
    throw new AppError(status.BAD_REQUEST, "This order has already been paid");
  }
  if (!order.orderNumber || !order.fullName || !order.phone || !order.address || !order.district) {
    throw new AppError(status.BAD_REQUEST, "Order is missing required details for payment");
  }

  const settings = await PaymentSettingService.getPaymentSettings();
  if (!settings.sslcommerzEnabled) {
    throw new AppError(status.BAD_REQUEST, "SSLCommerz is not enabled");
  }

  const gatewayPageURL = await SslcommerzService.initiateSession({
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    fullName: order.fullName,
    phone: order.phone,
    address: order.address,
    district: order.district,
  });

  return { gatewayPageURL, orderId: order.id };
};

// Shared by the success redirect and the IPN callback — always re-validates
// server-side rather than trusting the redirect/webhook payload directly.
const confirmSslcommerzPayment = async (tranId: string, valId: string) => {
  const order = await prisma.order.findUnique({ where: { orderNumber: tranId } });
  if (!order) throw new AppError(status.NOT_FOUND, "Order not found for this transaction");

  if (order.paymentStatus === PaymentStatus.PAID) {
    return order; // already processed (success callback + IPN both firing)
  }

  const validation = await SslcommerzService.validateTransaction(valId);
  const isValid = validation.status === "VALID" || validation.status === "VALIDATED";
  const amountMatches = Math.abs(Number(validation.amount) - order.totalAmount) < 1;

  if (!isValid || !amountMatches) {
    await OrderService.updatePaymentStatus(order.id, PaymentStatus.FAILED);
    throw new AppError(status.BAD_REQUEST, "Payment could not be validated");
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentMethod: "SSLCOMMERZ", paymentValId: valId },
  });
  await OrderService.updatePaymentStatus(order.id, PaymentStatus.PAID);

  return order;
};

const markSslcommerzPaymentFailed = async (tranId: string) => {
  const order = await prisma.order.findUnique({ where: { orderNumber: tranId } });
  if (order && order.paymentStatus !== PaymentStatus.PAID) {
    await OrderService.updatePaymentStatus(order.id, PaymentStatus.FAILED);
  }
  return order;
};

// ── bKash ────────────────────────────────────────────────────────────────

// guest = online or landing page order placed without an account; otherwise
// the order must belong to the signed-in customer
const initiateBkashPayment = async (orderId: string, requester: PaymentRequester) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(status.NOT_FOUND, "Order not found");
  assertCanPay(order, requester);
  if (order.paymentStatus === PaymentStatus.PAID) {
    throw new AppError(status.BAD_REQUEST, "This order has already been paid");
  }
  if (order.orderStatus === OrderStatus.CANCELLED) {
    throw new AppError(status.BAD_REQUEST, "This order has been cancelled");
  }
  if (!order.orderNumber) {
    throw new AppError(status.BAD_REQUEST, "Order is missing its order number");
  }

  // A retry needs a fresh invoice number, so each attempt gets a suffix
  const { paymentID, bkashURL } = await BkashService.createPayment({
    amount: order.totalAmount,
    invoiceNumber: `${order.orderNumber}-${Date.now().toString(36).toUpperCase()}`,
    payerReference: order.phone || order.orderNumber,
    callbackURL: `${backendApiBaseUrl()}/payments/bkash/callback`,
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentMethod: "BKASH", bkashPaymentId: paymentID },
  });

  return { bkashURL, orderId: order.id };
};

export type BkashCallbackResult =
  | { ok: true; orderId: string }
  | { ok: false; orderId?: string; isGuest?: boolean; reason: "cancelled" | "failed" };

// bKash redirects the customer here with ?paymentID&status. The payment only
// counts once our own execute (or status query) call says it completed for
// the full order amount.
const handleBkashCallback = async (
  paymentID: string | undefined,
  callbackStatus: string | undefined,
): Promise<BkashCallbackResult> => {
  if (!paymentID) return { ok: false, reason: "failed" };

  const order = await prisma.order.findUnique({ where: { bkashPaymentId: paymentID } });
  if (!order) return { ok: false, reason: "failed" };
  if (order.paymentStatus === PaymentStatus.PAID) return { ok: true, orderId: order.id };

  const fail = async (reason: "cancelled" | "failed") => {
    await OrderService.updatePaymentStatus(order.id, PaymentStatus.FAILED);
    return { ok: false as const, orderId: order.id, isGuest: !order.userId, reason };
  };

  if (callbackStatus !== "success") {
    return fail(callbackStatus === "cancel" ? "cancelled" : "failed");
  }

  let result = await BkashService.executePayment(paymentID).catch(() => null);
  // Execute can time out or report "already executed"; the status query is
  // the source of truth then
  if (!result || !BkashService.isCompleted(result)) {
    result = await BkashService.queryPayment(paymentID).catch(() => null);
  }

  const amountMatches =
    result?.amount !== undefined &&
    Math.abs(Number(result.amount) - order.totalAmount) < 1;

  if (!result || !BkashService.isCompleted(result) || !amountMatches) {
    return fail("failed");
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentMethod: "BKASH", paymentValId: result.trxID ?? null },
  });
  await OrderService.updatePaymentStatus(order.id, PaymentStatus.PAID);

  return { ok: true, orderId: order.id };
};

export const PaymentService = {
  initiateSslcommerzPayment,
  confirmSslcommerzPayment,
  markSslcommerzPaymentFailed,
  initiateBkashPayment,
  handleBkashCallback,
};
