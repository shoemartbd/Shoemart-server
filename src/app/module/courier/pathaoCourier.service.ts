import AppError from "../../errorHelpers/AppError";
import status from "http-status";
import { CourierSettingService } from "../courier-setting/courierSetting.service";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

const getAccessToken = async (baseUrl: string, credentials: {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}) => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const res = await fetch(`${baseUrl}/aladdin/api/v1/issue-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      username: credentials.username,
      password: credentials.password,
      grant_type: "password",
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new AppError(
      status.BAD_GATEWAY,
      `Pathao auth failed: ${data.message || res.statusText}`,
    );
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };

  return cachedToken.accessToken;
};

const createOrder = async (order: {
  orderNumber: string;
  fullName: string;
  phone: string;
  address: string;
  district: string;
  notes?: string | null;
  totalAmount: number;
  paymentStatus: string;
}, itemQuantity: number) => {
  const settings = await CourierSettingService.getCourierSettings();

  if (!settings.pathaoEnabled) {
    throw new AppError(status.BAD_REQUEST, "Pathao courier is not enabled in settings");
  }
  if (
    !settings.pathaoBaseUrl ||
    !settings.pathaoClientId ||
    !settings.pathaoClientSecret ||
    !settings.pathaoUsername ||
    !settings.pathaoPassword ||
    !settings.pathaoStoreId
  ) {
    throw new AppError(status.BAD_REQUEST, "Pathao settings are incomplete");
  }

  const baseUrl = settings.pathaoBaseUrl.replace(/\/$/, "");
  const token = await getAccessToken(baseUrl, {
    clientId: settings.pathaoClientId,
    clientSecret: settings.pathaoClientSecret,
    username: settings.pathaoUsername,
    password: settings.pathaoPassword,
  });

  const amountToCollect =
    order.paymentStatus === "PAID" ? 0 : Math.round(order.totalAmount);

  // recipient_city/zone/area are intentionally omitted — per Pathao's docs
  // they're optional and get auto-populated from recipient_address when absent.
  const res = await fetch(`${baseUrl}/aladdin/api/v1/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      store_id: Number(settings.pathaoStoreId),
      merchant_order_id: order.orderNumber,
      recipient_name: order.fullName,
      recipient_phone: order.phone,
      recipient_address: `${order.address}, ${order.district}`,
      delivery_type: 48, // normal delivery
      item_type: 2, // parcel
      special_instruction: order.notes || undefined,
      item_quantity: Math.max(1, itemQuantity),
      item_weight: 0.5,
      amount_to_collect: amountToCollect,
      item_description: `Order ${order.orderNumber}`,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.type === "error") {
    throw new AppError(
      status.BAD_GATEWAY,
      `Pathao order creation failed: ${data.message || res.statusText}`,
    );
  }

  const consignmentId = data?.data?.consignment_id;
  const orderStatus = data?.data?.order_status;

  return {
    consignmentId: consignmentId ? String(consignmentId) : undefined,
    trackingCode: consignmentId ? String(consignmentId) : undefined,
    statusText: orderStatus || "Pending",
  };
};

export const PathaoCourierService = {
  createOrder,
};
