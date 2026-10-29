import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { guestOrderRateLimiter, orderTrackRateLimiter } from "../../middleware/rateLimiter";
import { OrderController } from "./order.controller";
import {
  createGuestOrderZodSchema,
  createOrderZodSchema,
  trackOrderZodSchema,
  updateOrderItemZodSchema,
  updateOrderStatusZodSchema,
  updateOrderDiscountZodSchema,
  updatePaymentStatusZodSchema,
  assignCourierZodSchema,
  bulkOrderUpdateZodSchema,
  bulkOrderDeleteZodSchema,
} from "./order.validation";

const router = Router();

// Create order & Get My orders (Any user)
router.post(
  "/",
  checkAuth(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(createOrderZodSchema),
  OrderController.createOrder,
);

// Public — online checkout without an account (when enabled in Site Settings)
router.post(
  "/guest",
  guestOrderRateLimiter,
  validateRequest(createGuestOrderZodSchema),
  OrderController.createGuestOrder,
);

router.get(
  "/my-orders",
  checkAuth(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  OrderController.getMyOrders,
);

// Admin — per-item fulfillment management
router.patch(
  "/items/:id/status",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updateOrderStatusZodSchema),
  OrderController.updateOrderItemStatus,
);

router.patch(
  "/items/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updateOrderItemZodSchema),
  OrderController.updateOrderItem,
);

// Admin only routes
router.get(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  OrderController.getAllOrders,
);

// RedX delivery areas, ?district=Dhaka (used when dispatching to RedX)
router.get(
  "/redx-areas",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  OrderController.getRedxAreas,
);

// Excel download: every order matching the list filters
router.get(
  "/export",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  OrderController.exportOrders,
);

// Bulk actions from the order list (selected orders)
router.patch(
  "/bulk",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(bulkOrderUpdateZodSchema),
  OrderController.bulkOrderAction,
);

router.post(
  "/bulk-delete",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(bulkOrderDeleteZodSchema),
  (req, _res, next) => {
    req.body.action = "delete";
    next();
  },
  OrderController.bulkOrderAction,
);

router.patch(
  "/:id/status",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updateOrderStatusZodSchema),
  OrderController.updateOrderStatus,
);

router.patch(
  "/:id/discount",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updateOrderDiscountZodSchema),
  OrderController.updateOrderDiscount,
);

router.patch(
  "/:id/payment-status",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updatePaymentStatusZodSchema),
  OrderController.updatePaymentStatus,
);

router.patch(
  "/:id/assign-courier",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(assignCourierZodSchema),
  OrderController.assignCourier,
);

router.delete(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  OrderController.deleteOrder,
);

// Public — powers the guest-safe order-confirmation ("Thank You") page, no auth required
router.get("/:id/public", OrderController.getPublicOrderById);

// Public — order tracking by orderNumber + phone (no auth), rate-limited against brute force
router.post(
  "/track",
  orderTrackRateLimiter,
  validateRequest(trackOrderZodSchema),
  OrderController.trackOrder,
);

// Get single order detail
router.get(
  "/:id",
  checkAuth(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  OrderController.getOrderById,
);

// Courier fraud check (based on the order's phone number)
router.get(
  "/:id/fraud-check",
  checkAuth(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  OrderController.checkOrderFraud,
);

export const OrderRoutes = router;
