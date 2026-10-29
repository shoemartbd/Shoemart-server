import AppError from "../../errorHelpers/AppError";
import status from "http-status";
import { CourierSettingService } from "../courier-setting/courierSetting.service";

// RedX Open API v1.0.0-beta
const BASE_URLS = {
  SANDBOX: "https://sandbox.redx.com.bd/v1.0.0-beta",
  LIVE: "https://openapi.redx.com.bd/v1.0.0-beta",
} as const;

export interface RedxArea {
  id: number;
  name: string;
  post_code?: number | string | null;
  division_name?: string | null;
  zone_id?: number | null;
}

const getConfig = async () => {
  const settings = await CourierSettingService.getCourierSettings();
  if (!settings.redxEnabled) {
    throw new AppError(status.BAD_REQUEST, "RedX courier is not enabled in settings");
  }
  if (!settings.redxAccessToken) {
    throw new AppError(status.BAD_REQUEST, "RedX access token is missing in Courier Settings");
  }
  return {
    baseUrl: settings.redxMode === "LIVE" ? BASE_URLS.LIVE : BASE_URLS.SANDBOX,
    token: settings.redxAccessToken.replace(/^Bearer\s+/i, ""),
    pickupStoreId: settings.redxPickupStoreId,
  };
};

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const { baseUrl, token } = await getConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "API-ACCESS-TOKEN": `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      data?.message ||
      (data?.errors && Object.values(data.errors).flat().join(", ")) ||
      res.statusText;
    throw new AppError(status.BAD_GATEWAY, `RedX: ${detail}`);
  }
  return data as T;
};

// Area list barely changes; keep each district's list for a day
const areaCache = new Map<string, { areas: RedxArea[]; expiresAt: number }>();

// RedX delivers to areas (thana / zone), so a parcel needs one of these ids.
// Our checkout only collects the district, so the admin picks the area.
const getAreas = async (district?: string) => {
  const key = (district ?? "").trim().toLowerCase();
  const hit = areaCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.areas;

  const query = key ? `?district_name=${encodeURIComponent(district!.trim())}` : "";
  const data = await request<{ areas?: RedxArea[] }>(`/areas${query}`);
  const areas = (data.areas ?? []).sort((a, b) => a.name.localeCompare(b.name));
  areaCache.set(key, { areas, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
  return areas;
};

const createOrder = async (
  order: {
    orderNumber: string;
    fullName: string;
    phone: string;
    address: string;
    district: string;
    notes?: string | null;
    totalAmount: number;
    paymentStatus: string;
  },
  area: { id: number; name: string },
  items: { name: string; quantity: number; price: number }[],
) => {
  const { pickupStoreId } = await getConfig();
  const cashToCollect = order.paymentStatus === "PAID" ? 0 : Math.round(order.totalAmount);
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);

  const data = await request<{ tracking_id?: string }>("/parcel", {
    method: "POST",
    body: JSON.stringify({
      customer_name: order.fullName,
      customer_phone: order.phone,
      delivery_area: area.name,
      delivery_area_id: area.id,
      customer_address: `${order.address}, ${order.district}`,
      merchant_invoice_id: order.orderNumber,
      cash_collection_amount: String(cashToCollect),
      // RedX wants grams; ~500 g per item is a safe default for apparel
      parcel_weight: Math.max(500, itemCount * 500),
      instruction: order.notes || "",
      value: Math.round(order.totalAmount),
      ...(pickupStoreId && { pickup_store_id: Number(pickupStoreId) }),
      parcel_details_json: items.map((i) => ({
        name: i.name.slice(0, 100),
        category: "General",
        value: Math.round(i.price * i.quantity),
      })),
    }),
  });

  if (!data.tracking_id) {
    throw new AppError(status.BAD_GATEWAY, "RedX did not return a tracking ID");
  }
  return {
    consignmentId: data.tracking_id,
    trackingCode: data.tracking_id,
    statusText: "pickup-pending",
  };
};

export const RedxCourierService = {
  getAreas,
  createOrder,
};
