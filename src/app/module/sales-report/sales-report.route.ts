import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { SalesReportController } from "./sales-report.controller";

const router = Router();

router.get("/summary", checkAuth(Role.ADMIN, Role.SUPER_ADMIN), SalesReportController.getSalesSummary);
router.get("/items", checkAuth(Role.ADMIN, Role.SUPER_ADMIN), SalesReportController.getSalesReportItems);

export const SalesReportRoutes = router;
