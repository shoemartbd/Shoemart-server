import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CouponController } from "./coupon.controller";
import { createCouponZodSchema } from "./coupon.validation";

const router = Router();

router.post(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(createCouponZodSchema),
  CouponController.createCoupon
);

router.get(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  CouponController.getAllCoupons
);

router.get(
  "/:id",
  CouponController.getCouponById
);

router.patch(
  "/:id/status",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  CouponController.toggleCouponStatus
);

router.delete(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  CouponController.deleteCoupon
);

// Public route — validate coupon at checkout
router.post("/validate", CouponController.validateCoupon);

export const CouponRoutes = router;
