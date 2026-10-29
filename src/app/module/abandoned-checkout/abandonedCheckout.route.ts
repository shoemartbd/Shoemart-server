import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { abandonedCheckoutTrackRateLimiter } from "../../middleware/rateLimiter";
import { AbandonedCheckoutController } from "./abandonedCheckout.controller";
import { trackAbandonedCheckoutZodSchema } from "./abandonedCheckout.validation";

const router = Router();

// Public — fired from the checkout/landing-page forms as the customer fills them in
router.post(
  "/track",
  abandonedCheckoutTrackRateLimiter,
  validateRequest(trackAbandonedCheckoutZodSchema),
  AbandonedCheckoutController.trackCheckout,
);

router.get(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  AbandonedCheckoutController.getAbandonedCheckouts,
);

router.delete(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  AbandonedCheckoutController.deleteAbandonedCheckout,
);

export const AbandonedCheckoutRoutes = router;
