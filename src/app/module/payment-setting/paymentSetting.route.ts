import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentSettingController } from "./paymentSetting.controller";
import {
  updateCodSettingZodSchema,
  updateSslcommerzSettingZodSchema,
  updateBkashSettingZodSchema,
} from "./paymentSetting.validation";

const router = Router();

// Public — the storefront checkout only learns which methods are on
router.get("/", PaymentSettingController.getPublicPaymentSettings);

router.get(
  "/admin",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PaymentSettingController.getPaymentSettings,
);

router.patch(
  "/cod",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updateCodSettingZodSchema),
  PaymentSettingController.updateCodSettings,
);

router.patch(
  "/sslcommerz",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updateSslcommerzSettingZodSchema),
  PaymentSettingController.updateSslcommerzSettings,
);

router.patch(
  "/bkash",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updateBkashSettingZodSchema),
  PaymentSettingController.updateBkashSettings,
);

export const PaymentSettingRoutes = router;
