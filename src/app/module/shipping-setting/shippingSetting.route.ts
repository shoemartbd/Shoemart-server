import express from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { ShippingSettingController } from "./shippingSetting.controller";
import { updateShippingSettingZodSchema } from "./shippingSetting.validation";

const router = express.Router();

router.get(
  "/",
  ShippingSettingController.getShippingSettings
);

router.patch(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updateShippingSettingZodSchema),
  ShippingSettingController.updateShippingSettings
);

export const ShippingSettingRoutes = router;
