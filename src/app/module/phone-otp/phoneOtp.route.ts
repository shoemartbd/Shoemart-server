import { Request, Response, Router } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { phoneOtpSendRateLimiter, phoneOtpVerifyRateLimiter } from "../../middleware/rateLimiter";
import { PhoneOtpService } from "./phoneOtp.service";

const router = Router();

// Public: is phone verification on?
router.get(
  "/status",
  catchAsync(async (_req: Request, res: Response) => {
    const data = await PhoneOtpService.getStatus();
    sendResponse(res, { httpStatusCode: 200, success: true, message: "Phone OTP status", data });
  }),
);

router.post(
  "/send",
  phoneOtpSendRateLimiter,
  catchAsync(async (req: Request, res: Response) => {
    const data = await PhoneOtpService.sendCode(req.body?.phone, req.ip);
    sendResponse(res, {
      httpStatusCode: 200,
      success: true,
      message: data.sent ? "Code sent" : data.message,
      data,
    });
  }),
);

router.post(
  "/verify",
  phoneOtpVerifyRateLimiter,
  catchAsync(async (req: Request, res: Response) => {
    const data = await PhoneOtpService.verifyCode(req.body?.phone, req.body?.code);
    sendResponse(res, { httpStatusCode: 200, success: true, message: "Phone number verified", data });
  }),
);

export const PhoneOtpRoutes = router;
