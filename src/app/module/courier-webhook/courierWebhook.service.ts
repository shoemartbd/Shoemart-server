import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { OrderStatus } from "../../../generated/prisma/enums";
import { CourierSettingService } from "../courier-setting/courierSetting.service";
import { OrderService } from "../order/order.service";

// Only statuses that map cleanly to our own OrderStatus enum trigger a
// cascade — partial_delivered/pending/unknown just update courierStatus text.
const DELIVERY_STATUS_TO_ORDER_STATUS: Record<string, OrderStatus> = {
  delivered: OrderStatus.DELIVERED,
  cancelled: OrderStatus.CANCELLED,
};

interface SteadfastWebhookPayload {
  notification_type: "delivery_status" | "tracking_update" | string;
  consignment_id?: number;
  invoice?: string;
  status?: string;
  tracking_message?: string;
}

const processSteadfastWebhook = async (
  payload: SteadfastWebhookPayload,
  authHeader: string | undefined,
) => {
  const settings = await CourierSettingService.getCourierSettings();

  if (settings.steadfastWebhookAuthToken) {
    const expected = `Bearer ${settings.steadfastWebhookAuthToken}`;
    if (authHeader !== expected) {
      throw new AppError(status.UNAUTHORIZED, "Invalid webhook auth token");
    }
  }

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        ...(payload.invoice ? [{ orderNumber: payload.invoice }] : []),
        ...(payload.consignment_id
          ? [{ courierConsignmentId: String(payload.consignment_id) }]
          : []),
      ],
    },
  });

  if (!order) {
    throw new AppError(status.NOT_FOUND, "Order not found for this webhook");
  }

  if (payload.notification_type === "delivery_status" && payload.status) {
    await prisma.order.update({
      where: { id: order.id },
      data: { courierStatus: payload.status },
    });

    const mappedStatus = DELIVERY_STATUS_TO_ORDER_STATUS[payload.status.toLowerCase()];
    if (mappedStatus && order.orderStatus !== mappedStatus) {
      await OrderService.updateOrderStatus(order.id, mappedStatus);
    }
  } else if (payload.notification_type === "tracking_update" && payload.tracking_message) {
    await prisma.order.update({
      where: { id: order.id },
      data: { courierStatus: payload.tracking_message },
    });
  }

  return { received: true };
};

// ── RedX ─────────────────────────────────────────────────────────────────
// RedX posts parcel status changes to the callback URL set in the RedX panel:
// {tracking_number, invoice_number, status, message_en, message_bn, timestamp}
// Status values include: ready-for-delivery, delivery-in-progress, delivered,
// agent-hold, agent-returning, returned, agent-area-change.
const REDX_STATUS_TO_ORDER_STATUS: Record<string, OrderStatus> = {
  delivered: OrderStatus.DELIVERED,
};

interface RedxWebhookPayload {
  tracking_number?: string;
  tracking_id?: string;
  invoice_number?: string;
  merchant_invoice_id?: string;
  status?: string;
  message_en?: string;
}

const processRedxWebhook = async (payload: RedxWebhookPayload, token: string | undefined) => {
  const settings = await CourierSettingService.getCourierSettings();
  if (settings.redxWebhookToken && token !== settings.redxWebhookToken) {
    throw new AppError(status.UNAUTHORIZED, "Invalid webhook token");
  }

  const trackingId = payload.tracking_number || payload.tracking_id;
  const invoice = payload.invoice_number || payload.merchant_invoice_id;
  const order = await prisma.order.findFirst({
    where: {
      courierProvider: "REDX",
      OR: [
        ...(trackingId ? [{ courierTrackingCode: trackingId }, { courierConsignmentId: trackingId }] : []),
        ...(invoice ? [{ orderNumber: invoice }] : []),
      ],
    },
  });
  if (!order) throw new AppError(status.NOT_FOUND, "Order not found for this webhook");

  if (payload.status) {
    await prisma.order.update({
      where: { id: order.id },
      data: { courierStatus: payload.status },
    });
    const mapped = REDX_STATUS_TO_ORDER_STATUS[payload.status.toLowerCase()];
    if (mapped && order.orderStatus !== mapped) {
      await OrderService.updateOrderStatus(order.id, mapped);
    }
  }
  return { received: true };
};

export const CourierWebhookService = {
  processSteadfastWebhook,
  processRedxWebhook,
};
