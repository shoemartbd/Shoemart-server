import { SmsSettingService } from "../sms-setting/smsSetting.service";

const BULKSMS_BASE_URL = "http://bulksmsbd.net/api/smsapi";
const BULKSMS_BALANCE_URL = "http://bulksmsbd.net/api/getBalanceApi";
const TIMEOUT_MS = 10_000;

// BulkSMSBD answers 202 when the SMS is accepted; other codes are errors,
// e.g. 1007 = balance insufficient, 1002 = sender id not correct
const SUCCESS_CODE = 202;
const ERROR_TEXT: Record<number, string> = {
  1001: "Invalid number",
  1002: "Sender ID not correct or disabled",
  1003: "Required fields missing",
  1005: "Internal error at the SMS provider",
  1006: "Balance validity not available",
  1007: "SMS balance is insufficient",
  1011: "User ID not found",
  1012: "Masking SMS must be sent in Bengali",
  1013: "Sender ID has no gateway with this API key",
  1014: "Sender type name not found",
  1015: "Sender ID has no valid gateway",
  1016: "Sender type name active price info not found",
  1017: "Sender type name price info not found",
  1018: "The account is disabled",
  1019: "The account's sender type price is disabled",
  1020: "The parent account was not found",
  1021: "The parent's active sender type price was not found",
  1031: "The account is not verified",
  1032: "IP is not whitelisted",
};

// Bangladeshi numbers need the "88" country-code prefix for BulkSMSBD
const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("88")) return digits;
  if (digits.startsWith("0")) return `88${digits}`;
  return `88${digits}`;
};

const fetchJson = async (url: string) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { raw: text } as Record<string, unknown>;
    }
  } finally {
    clearTimeout(timer);
  }
};

export type SmsSendResult =
  | { ok: true }
  | { ok: false; reason: "NOT_CONFIGURED" | "GATEWAY_ERROR"; message: string };

// Sends and reports whether the gateway accepted it. Used where the caller
// must know (OTP codes). Never throws.
const sendSmsChecked = async (phone: string, message: string): Promise<SmsSendResult> => {
  try {
    const settings = await SmsSettingService.getSmsSettings();
    if (!settings.apiKey || !settings.senderId) {
      return { ok: false, reason: "NOT_CONFIGURED", message: "SMS API key / sender ID missing" };
    }
    if (!settings.enabled) {
      return {
        ok: false,
        reason: "NOT_CONFIGURED",
        message: "SMS Status is Inactive in Dashboard → SMS Settings",
      };
    }

    const params = new URLSearchParams({
      api_key: settings.apiKey,
      type: "text",
      number: normalizePhone(phone),
      senderid: settings.senderId,
      message,
    });
    const body = await fetchJson(`${BULKSMS_BASE_URL}?${params.toString()}`);
    const code = Number(body.response_code);
    if (code === SUCCESS_CODE) return { ok: true };

    const detail =
      ERROR_TEXT[code] ||
      (typeof body.error_message === "string" && body.error_message) ||
      `Unexpected reply (${code || "no code"})`;
    console.error("SMS gateway refused the message:", code, detail);
    return { ok: false, reason: "GATEWAY_ERROR", message: detail };
  } catch (error) {
    console.error("Failed to send SMS:", error);
    return {
      ok: false,
      reason: "GATEWAY_ERROR",
      message: (error as Error)?.name === "AbortError" ? "SMS provider timed out" : "SMS provider unreachable",
    };
  }
};

// Best-effort — never throws, so a failed/unconfigured SMS never breaks the
// order flow that triggered it.
const sendSms = async (phone: string, message: string) => {
  await sendSmsChecked(phone, message);
};

// Remaining SMS balance (in taka) from BulkSMSBD, or why it can't be read
const getBalance = async (): Promise<
  { ok: true; balance: number; enabled: boolean } | { ok: false; message: string }
> => {
  try {
    const settings = await SmsSettingService.getSmsSettings();
    if (!settings.apiKey) return { ok: false, message: "SMS API key is not set" };
    const body = await fetchJson(
      `${BULKSMS_BALANCE_URL}?${new URLSearchParams({ api_key: settings.apiKey }).toString()}`,
    );
    const code = Number(body.response_code);
    const balance = Number(body.balance);
    if (code === SUCCESS_CODE && Number.isFinite(balance)) {
      // enabled = the Status switch in SMS Settings; when off nothing is sent
      return { ok: true, balance, enabled: settings.enabled };
    }
    return {
      ok: false,
      message:
        ERROR_TEXT[code] ||
        (typeof body.error_message === "string" && body.error_message) ||
        "Could not read the balance",
    };
  } catch {
    return { ok: false, message: "SMS provider unreachable" };
  }
};

export const SmsService = {
  sendSms,
  sendSmsChecked,
  getBalance,
};
