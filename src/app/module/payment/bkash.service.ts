import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { PaymentSettingService } from "../payment-setting/paymentSetting.service";

// bKash Tokenized Checkout v1.2.0-beta
// https://developer.bka.sh/docs/checkout-process-overview
const BASE_URLS = {
  SANDBOX: "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout",
  LIVE: "https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout",
} as const;

const SUCCESS = "0000";

interface BkashConfig {
  baseUrl: string;
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
}

export interface BkashPaymentResult {
  statusCode?: string;
  statusMessage?: string;
  paymentID?: string;
  trxID?: string;
  transactionStatus?: string;
  amount?: string;
  merchantInvoiceNumber?: string;
  bkashURL?: string;
  errorCode?: string;
  errorMessage?: string;
}

const getConfig = async (): Promise<BkashConfig> => {
  const settings = await PaymentSettingService.getPaymentSettings();

  if (!settings.bkashEnabled) {
    throw new AppError(status.BAD_REQUEST, "bKash payment is not enabled");
  }
  const { bkashAppKey, bkashAppSecret, bkashUsername, bkashPassword } = settings;
  if (!bkashAppKey || !bkashAppSecret || !bkashUsername || !bkashPassword) {
    throw new AppError(
      status.BAD_REQUEST,
      "bKash credentials are not configured in Payment Settings",
    );
  }

  return {
    baseUrl: settings.bkashMode === "LIVE" ? BASE_URLS.LIVE : BASE_URLS.SANDBOX,
    appKey: bkashAppKey,
    appSecret: bkashAppSecret,
    username: bkashUsername,
    password: bkashPassword,
  };
};

// id_token lasts an hour; reuse it instead of granting one per payment.
// Keyed by credentials so switching mode / keys never reuses a stale token.
let cachedToken: { key: string; token: string; expiresAt: number } | null = null;

const grantToken = async (config: BkashConfig) => {
  const key = `${config.baseUrl}|${config.appKey}|${config.username}`;
  if (cachedToken && cachedToken.key === key && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const res = await fetch(`${config.baseUrl}/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: config.username,
      password: config.password,
    },
    body: JSON.stringify({ app_key: config.appKey, app_secret: config.appSecret }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    id_token?: string;
    expires_in?: number;
    statusCode?: string;
    statusMessage?: string;
    msg?: string;
  };

  if (!data.id_token) {
    throw new AppError(
      status.BAD_GATEWAY,
      `bKash authentication failed: ${data.statusMessage || data.msg || "check the bKash credentials"}`,
    );
  }

  // Refresh a few minutes early
  const lifetimeMs = Math.max(60, (data.expires_in ?? 3600) - 300) * 1000;
  cachedToken = { key, token: data.id_token, expiresAt: Date.now() + lifetimeMs };
  return data.id_token;
};

const call = async (path: string, body: Record<string, string>) => {
  const config = await getConfig();
  const token = await grantToken(config);

  const res = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: token,
      "X-APP-Key": config.appKey,
    },
    body: JSON.stringify(body),
  });
  return (await res.json().catch(() => ({}))) as BkashPaymentResult;
};

const createPayment = async (payload: {
  amount: number;
  invoiceNumber: string;
  payerReference: string;
  callbackURL: string;
}) => {
  const data = await call("/create", {
    mode: "0011",
    payerReference: payload.payerReference,
    callbackURL: payload.callbackURL,
    amount: payload.amount.toFixed(2),
    currency: "BDT",
    intent: "sale",
    merchantInvoiceNumber: payload.invoiceNumber,
  });

  if (data.statusCode !== SUCCESS || !data.paymentID || !data.bkashURL) {
    throw new AppError(
      status.BAD_GATEWAY,
      `bKash payment could not be started: ${data.statusMessage || data.errorMessage || "unknown error"}`,
    );
  }
  return { paymentID: data.paymentID, bkashURL: data.bkashURL };
};

const executePayment = (paymentID: string) => call("/execute", { paymentID });

const queryPayment = (paymentID: string) => call("/payment/status", { paymentID });

const isCompleted = (result: BkashPaymentResult) =>
  result.statusCode === SUCCESS && result.transactionStatus === "Completed";

export const BkashService = {
  createPayment,
  executePayment,
  queryPayment,
  isCompleted,
};
