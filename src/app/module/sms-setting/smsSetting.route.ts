import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { SmsSettingController } from "./smsSetting.controller";
import { updateSmsSettingZodSchema } from "./smsSetting.validation";

const router = Router();

// Admin-only — holds a live API key, unlike shipping/payment settings the
// storefront never needs to read this
router.use(checkAuth(Role.ADMIN, Role.SUPER_ADMIN));

router.get("/", SmsSettingController.getSmsSettings);

router.patch(
  "/",
  validateRequest(updateSmsSettingZodSchema),
  SmsSettingController.updateSmsSettings,
);

export const SmsSettingRoutes = router;
