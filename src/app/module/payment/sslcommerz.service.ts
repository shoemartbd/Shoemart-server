import AppError from "../../errorHelpers/AppError";
import status from "http-status";
import { envVars } from "../../config/env";
import { PaymentSettingService } from "../payment-setting/paymentSetting.service";

const getConfig = async () => {
  const settings = await PaymentSettingService.getPaymentSettings();

  if (!settings.sslcommerzEnabled) {
    throw new AppError(status.BAD_REQUEST, "SSLCommerz is not enabled");
  }
  if (!settings.sslcommerzStoreId || !settings.sslcommerzStorePassword) {
    throw new AppError(
      status.BAD_REQUEST,
      "SSLCommerz Store ID / Store Password are not configured in Payment Settings",
    );
  }

  const baseUrl =
    settings.sslcommerzMode === "LIVE"
      ? "https://securepay.sslcommerz.com"
      : "https://sandbox.sslcommerz.com";

  return {
    storeId: settings.sslcommerzStoreId,
    storePassword: settings.sslcommerzStorePassword,
    baseUrl,
  };
};

export const backendApiBaseUrl = () =>
  `${process.env.BACKEND_URL || `http://localhost:${envVars.PORT}`}/api/v1`;

const initiateSession = async (order: {
  orderNumber: string;
  totalAmount: number;
  fullName: string;
  phone: string;
  address: string;
  district: string;
}) => {
  const { storeId, storePassword, baseUrl } = await getConfig();
  const apiBase = backendApiBaseUrl();

  const body = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePassword,
    total_amount: String(order.totalAmount),
    currency: "BDT",
    tran_id: order.orderNumber,
    product_category: "General",
    success_url: `${apiBase}/payments/sslcommerz/success`,
    fail_url: `${apiBase}/payments/sslcommerz/fail`,
    cancel_url: `${apiBase}/payments/sslcommerz/cancel`,
    ipn_url: `${apiBase}/payments/sslcommerz/ipn`,
    cus_name: order.fullName,
    cus_email: "customer@example.com",
    cus_phone: order.phone,
    cus_add1: order.address,
    cus_city: order.district,
    cus_country: "Bangladesh",
    product_name: `Order ${order.orderNumber}`,
    product_profile: "physical-goods",
    shipping_method: "NO",
  });

  const res = await fetch(`${baseUrl}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  if (data.status !== "SUCCESS" || !data.GatewayPageURL) {
    throw new AppError(
      status.BAD_GATEWAY,
      `SSLCommerz session init failed: ${data.failedreason || "unknown error"}`,
    );
  }

  return data.GatewayPageURL as string;
};

const validateTransaction = async (valId: string) => {
  const { storeId, storePassword, baseUrl } = await getConfig();

  const params = new URLSearchParams({
    val_id: valId,
    store_id: storeId,
    store_passwd: storePassword,
    format: "json",
  });

  const res = await fetch(
    `${baseUrl}/validator/api/validationserverAPI.php?${params.toString()}`,
  );
  const data = await res.json();

  return data as {
    status: string;
    tran_id: string;
    amount: string;
    currency: string;
  };
};

export const SslcommerzService = {
  initiateSession,
  validateTransaction,
};
