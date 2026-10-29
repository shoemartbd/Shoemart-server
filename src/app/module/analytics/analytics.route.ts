import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { AnalyticsController } from "./analytics.controller";

const router = Router();

router.get(
  "/admin",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  AnalyticsController.getAdminAnalytics,
);

router.get(
  "/user",
  checkAuth(Role.USER),
  AnalyticsController.getUserAnalytics,
);

export const AnalyticsRoutes = router;
