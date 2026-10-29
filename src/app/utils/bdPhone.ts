import z from "zod";

// Bangladeshi mobile: 11 digits, 01 + operator digit 3–9 (013–019)
export const BD_MOBILE_REGEX = /^01[3-9]\d{8}$/;

export const BD_MOBILE_MESSAGE =
  "Enter a valid 11-digit Bangladeshi mobile number (e.g. 017XXXXXXXX)";

// Accepts what customers actually type: Bangla digits, spaces/dashes and a
// +88 / 88 country prefix, and returns the plain 01XXXXXXXXX form
export const normalizeBdPhone = (raw: string) => {
  let digits = raw
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/\D/g, "");
  if (digits.startsWith("880") && digits.length === 13) digits = digits.slice(2);
  return digits;
};

// Required, normalized and checked; the stored value is always 01XXXXXXXXX
export const bdMobilePhoneSchema = z
  .string({ message: "Phone number is required" })
  .trim()
  .min(1, "Phone number is required")
  .transform(normalizeBdPhone)
  .refine((phone) => BD_MOBILE_REGEX.test(phone), BD_MOBILE_MESSAGE);
