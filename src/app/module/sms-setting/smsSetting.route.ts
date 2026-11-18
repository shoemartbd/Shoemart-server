import { Request, Response, Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { SmsSettingController } from "./smsSetting.controller";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { SmsService } from "../sms/sms.service";
import { updateSmsSettingZodSchema } from "./smsSetting.validation";

const router = Router();

// Admin-only — holds a live API key, unlike shipping/payment settings the
// storefront never needs to read this
router.use(checkAuth(Role.ADMIN, Role.SUPER_ADMIN));

router.get("/", SmsSettingController.getSmsSettings);

// Remaining SMS balance at BulkSMSBD (shown with a low-balance warning)
router.get(
  "/balance",
  catchAsync(async (_req: Request, res: Response) => {
    const data = await SmsService.getBalance();
    sendResponse(res, { httpStatusCode: 200, success: true, message: "SMS balance", data });
  }),
);

router.patch(
  "/",
  validateRequest(updateSmsSettingZodSchema),
  SmsSettingController.updateSmsSettings,
);

export const SmsSettingRoutes = router;
