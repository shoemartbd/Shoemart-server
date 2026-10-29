import express from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { GtmSettingController } from "./gtmSetting.controller";
import { updateGtmSettingZodSchema } from "./gtmSetting.validation";

const router = express.Router();

// Public: the container to load on the storefront, or null when off
router.get("/public", GtmSettingController.getPublicGtmSettings);

router.get(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  GtmSettingController.getGtmSettings,
);

router.patch(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updateGtmSettingZodSchema),
  GtmSettingController.updateGtmSettings,
);

export const GtmSettingRoutes = router;
