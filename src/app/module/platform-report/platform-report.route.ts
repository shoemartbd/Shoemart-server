import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { PlatformReportController } from "./platform-report.controller";

const router = Router();

router.use(checkAuth(Role.ADMIN, Role.SUPER_ADMIN));

router.get("/summary", PlatformReportController.getPlatformSummary);
router.get("/overview", PlatformReportController.getPlatformOverview);
router.get("/items", PlatformReportController.getPlatformItems);

export const PlatformReportRoutes = router;
