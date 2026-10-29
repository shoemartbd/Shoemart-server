import AppError from "../../errorHelpers/AppError";
import status from "http-status";
import { CourierSettingService } from "../courier-setting/courierSetting.service";

const STEADFAST_BASE_URL = "https://portal.packzy.com/api/v1";

const createOrder = async (order: {
  orderNumber: string;
  fullName: string;
  phone: string;
  address: string;
  district: string;
  notes?: string | null;
  totalAmount: number;
  paymentStatus: string;
}) => {
  const settings = await CourierSettingService.getCourierSettings();

  if (!settings.steadfastEnabled) {
    throw new AppError(status.BAD_REQUEST, "Steadfast courier is not enabled in settings");
  }
  if (!settings.steadfastApiKey || !settings.steadfastSecretKey) {
    throw new AppError(status.BAD_REQUEST, "Steadfast settings are incomplete");
  }

  const codAmount = order.paymentStatus === "PAID" ? 0 : order.totalAmount;

  const res = await fetch(`${STEADFAST_BASE_URL}/create_order`, {
    method: "POST",
    headers: {
      "Api-Key": settings.steadfastApiKey,
      "Secret-Key": settings.steadfastSecretKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invoice: order.orderNumber,
      recipient_name: order.fullName,
      recipient_phone: order.phone,
      recipient_address: `${order.address}, ${order.district}`,
      cod_amount: codAmount,
      note: order.notes || undefined,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.status !== 200) {
    throw new AppError(
      status.BAD_GATEWAY,
      `Steadfast order creation failed: ${data.message || res.statusText}`,
    );
  }

  const consignment = data.consignment;

  return {
    consignmentId: consignment?.consignment_id ? String(consignment.consignment_id) : undefined,
    trackingCode: consignment?.tracking_code,
    statusText: consignment?.status || "in_review",
  };
};

export const SteadfastCourierService = {
  createOrder,
};
