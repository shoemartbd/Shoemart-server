import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { PaymentController } from "./payment.controller";
import { guestOrderRateLimiter } from "../../middleware/rateLimiter";

const router = Router();

router.post(
  "/sslcommerz/initiate",
  checkAuth(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  PaymentController.initiateSslcommerzPayment,
);

// Orders placed without an account
router.post(
  "/sslcommerz/initiate-guest",
  guestOrderRateLimiter,
  PaymentController.initiateSslcommerzGuestPayment,
);

// Public — called directly by SSLCommerz's servers/browser redirects, not our app
router
  .route("/sslcommerz/success")
  .get(PaymentController.handleSuccess)
  .post(PaymentController.handleSuccess);

router
  .route("/sslcommerz/fail")
  .get(PaymentController.handleFail)
  .post(PaymentController.handleFail);

router
  .route("/sslcommerz/cancel")
  .get(PaymentController.handleCancel)
  .post(PaymentController.handleCancel);

router.post("/sslcommerz/ipn", PaymentController.handleIpn);

// bKash Tokenized Checkout
router.post(
  "/bkash/initiate",
  checkAuth(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  PaymentController.initiateBkashPayment,
);

// Orders placed without an account (online checkout or landing page)
router.post(
  "/bkash/initiate-guest",
  guestOrderRateLimiter,
  PaymentController.initiateBkashGuestPayment,
);

// Public — bKash sends the customer's browser back here
router.get("/bkash/callback", PaymentController.handleBkashCallback);

export const PaymentRoutes = router;
