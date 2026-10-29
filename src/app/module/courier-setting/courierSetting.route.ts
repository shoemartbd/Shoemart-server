import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CourierSettingController } from "./courierSetting.controller";
import {
  updatePathaoSettingZodSchema,
  updateSteadfastSettingZodSchema,
  updateRedxSettingZodSchema,
} from "./courierSetting.validation";

const router = Router();

// Admin-only — these hold courier API credentials
router.use(checkAuth(Role.ADMIN, Role.SUPER_ADMIN));

router.get("/", CourierSettingController.getCourierSettings);

router.patch(
  "/pathao",
  validateRequest(updatePathaoSettingZodSchema),
  CourierSettingController.updatePathaoSettings,
);

router.patch(
  "/steadfast",
  validateRequest(updateSteadfastSettingZodSchema),
  CourierSettingController.updateSteadfastSettings,
);

router.patch(
  "/redx",
  validateRequest(updateRedxSettingZodSchema),
  CourierSettingController.updateRedxSettings,
);

export const CourierSettingRoutes = router;
