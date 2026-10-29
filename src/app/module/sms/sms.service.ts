import { SmsSettingService } from "../sms-setting/smsSetting.service";

const BULKSMS_BASE_URL = "http://bulksmsbd.net/api/smsapi";

// Bangladeshi numbers need the "88" country-code prefix for BulkSMSBD
const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("88")) return digits;
  if (digits.startsWith("0")) return `88${digits}`;
  return `88${digits}`;
};

// Best-effort — never throws, so a failed/unconfigured SMS never breaks the
// order flow that triggered it.
const sendSms = async (phone: string, message: string) => {
  try {
    const settings = await SmsSettingService.getSmsSettings();
    if (!settings.enabled || !settings.apiKey || !settings.senderId) return;

    const params = new URLSearchParams({
      api_key: settings.apiKey,
      type: "text",
      number: normalizePhone(phone),
      senderid: settings.senderId,
      message,
    });

    await fetch(`${BULKSMS_BASE_URL}?${params.toString()}`);
  } catch (error) {
    console.error("Failed to send SMS:", error);
  }
};

export const SmsService = {
  sendSms,
};
