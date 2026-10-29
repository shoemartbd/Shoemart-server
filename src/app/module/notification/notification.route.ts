import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { NotificationController } from "./notification.controller";

const router = Router();

router.get(
  "/",
  checkAuth(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  NotificationController.getMyNotifications,
);

router.patch(
  "/read-all",
  checkAuth(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  NotificationController.markAllAsRead,
);

router.patch(
  "/:id/read",
  checkAuth(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  NotificationController.markAsRead,
);

export const NotificationRoutes = router;
