import { createHash, randomInt, timingSafeEqual } from "crypto";
import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { envVars } from "../../config/env";
import { jwtUtils } from "../../utils/jwt";
import { BD_MOBILE_MESSAGE, BD_MOBILE_REGEX, normalizeBdPhone } from "../../utils/bdPhone";
import { SiteSettingService } from "../site-setting/siteSetting.service";
import { BlockedPhoneService } from "../blocked-phone/blockedPhone.service";
import { SmsService } from "../sms/sms.service";

// Phone verification by SMS code (OTP) for guest orders.
//
// 1. send:   a 6-digit code is texted to the number (only its hash is stored)
// 2. verify: the right code returns a signed token for that number
// 3. order:  guest / landing-page orders must carry a token for the same
//            number, checked here on the server
//
// If the SMS gateway fails (no balance, provider down, not set up) the buyer
// is not blocked: send returns a short "unverified" token, the order goes
// through and is marked phoneVerified = false so the shop can call first.

const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_AFTER_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_WRONG_TRIES = 5;
const VERIFIED_TOKEN_TTL = "30d"; // the browser remembers a verified number
const FALLBACK_TOKEN_TTL = "1h"; // only long enough to finish the order
const PURPOSE = "phone_verify";

const hashCode = (phone: string, code: string) =>
  createHash("sha256").update(`${phone}:${code}:${envVars.ACCESS_TOKEN_SECRET}`).digest("hex");

const sameHash = (a: string, b: string) => {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
};

const cleanPhone = (raw: unknown) => {
  const phone = normalizeBdPhone(String(raw ?? ""));
  if (!BD_MOBILE_REGEX.test(phone)) throw new AppError(status.BAD_REQUEST, BD_MOBILE_MESSAGE);
  return phone;
};

const signToken = (phone: string, verified: boolean) =>
  jwtUtils.createToken({ purpose: PURPOSE, phone, verified }, envVars.ACCESS_TOKEN_SECRET, {
    expiresIn: verified ? VERIFIED_TOKEN_TTL : FALLBACK_TOKEN_TTL,
  });

const isEnabled = async () => Boolean((await SiteSettingService.getSiteSettings()).phoneOtpEnabled);

// Public: whether the storefront should ask for a code
const getStatus = async () => ({ enabled: await isEnabled() });

const sendCode = async (rawPhone: unknown, ip?: string) => {
  const phone = cleanPhone(rawPhone);
  if (!(await isEnabled())) {
    throw new AppError(status.BAD_REQUEST, "Phone verification is not needed right now");
  }
  // Numbers marked as fraud can't order, so don't spend an SMS on them
  await BlockedPhoneService.assertPhoneAllowed(phone);

  const now = Date.now();
  const recent = await prisma.phoneOtp.findMany({
    where: { phone, createdAt: { gte: new Date(now - 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const last = recent[0];
  if (last && now - last.createdAt.getTime() < RESEND_AFTER_MS) {
    const wait = Math.ceil((RESEND_AFTER_MS - (now - last.createdAt.getTime())) / 1000);
    throw new AppError(status.TOO_MANY_REQUESTS, `Please wait ${wait}s before asking for a new code`);
  }
  if (recent.length >= MAX_SENDS_PER_HOUR) {
    throw new AppError(
      status.TOO_MANY_REQUESTS,
      "Too many codes for this number. Please try again in an hour.",
    );
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.phoneOtp.create({
    data: {
      phone,
      codeHash: hashCode(phone, code),
      expiresAt: new Date(now + CODE_TTL_MS),
      ip: ip?.slice(0, 64) ?? null,
    },
  });

  // Old codes are useless after a day; tidy up in the background
  void prisma.phoneOtp
    .deleteMany({ where: { createdAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } } })
    .catch(() => undefined);

  const siteName = (await SiteSettingService.getSiteSettings()).siteName || "Shoe Mart";
  const sms = await SmsService.sendSmsChecked(
    phone,
    `${siteName}: Your verification code is ${code}. Valid for 5 minutes. Do not share this code.`,
  );

  if (sms.ok) {
    return {
      sent: true as const,
      expiresIn: CODE_TTL_MS / 1000,
      resendIn: RESEND_AFTER_MS / 1000,
    };
  }

  // The SMS couldn't go out: let the order through, marked unverified
  console.error(`Phone OTP not sent to ${phone}: ${sms.message}`);
  return {
    sent: false as const,
    fallback: true as const,
    token: signToken(phone, false),
    message: "We couldn't send the SMS right now. You can still place the order; we'll call to confirm.",
  };
};

const verifyCode = async (rawPhone: unknown, rawCode: unknown) => {
  const phone = cleanPhone(rawPhone);
  const code = String(rawCode ?? "").replace(/\D/g, "");
  if (code.length !== 6) throw new AppError(status.BAD_REQUEST, "Enter the 6-digit code");

  const otp = await prisma.phoneOtp.findFirst({
    where: { phone, verifiedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.expiresAt.getTime() < Date.now()) {
    throw new AppError(status.BAD_REQUEST, "The code has expired. Please send a new one.");
  }
  if (otp.attempts >= MAX_WRONG_TRIES) {
    throw new AppError(status.BAD_REQUEST, "Too many wrong tries. Please send a new code.");
  }

  if (!sameHash(otp.codeHash, hashCode(phone, code))) {
    const updated = await prisma.phoneOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    const left = MAX_WRONG_TRIES - updated.attempts;
    throw new AppError(
      status.BAD_REQUEST,
      left > 0
        ? `Wrong code. ${left} ${left === 1 ? "try" : "tries"} left.`
        : "Too many wrong tries. Please send a new code.",
    );
  }

  await prisma.phoneOtp.update({ where: { id: otp.id }, data: { verifiedAt: new Date() } });
  return { verified: true as const, token: signToken(phone, true) };
};

// For guest / landing-page orders. Returns what to store on the order:
// null = OTP is off, true = verified, false = taken unverified (SMS failed).
// Throws when OTP is on and the order has no valid token for this number.
const resolveForOrder = async (rawPhone: string, token?: string | null) => {
  if (!(await isEnabled())) return null;

  const phone = normalizeBdPhone(rawPhone);
  const fail = () => {
    throw new AppError(
      status.BAD_REQUEST,
      "Please verify your phone number with the SMS code before placing the order",
    );
  };
  if (!token) return fail();

  const decoded = jwtUtils.verifyToken(token, envVars.ACCESS_TOKEN_SECRET);
  if (!decoded.success || decoded.data?.purpose !== PURPOSE || decoded.data?.phone !== phone) {
    return fail();
  }
  return decoded.data.verified === true;
};

export const PhoneOtpService = {
  getStatus,
  sendCode,
  verifyCode,
  resolveForOrder,
};
