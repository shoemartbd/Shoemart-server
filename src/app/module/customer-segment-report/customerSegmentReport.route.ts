import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { CustomerSegmentReportController } from "./customerSegmentReport.controller";

const router = Router();

router.use(checkAuth(Role.ADMIN, Role.SUPER_ADMIN));

router.get("/overview", CustomerSegmentReportController.getOverview);

export const CustomerSegmentReportRoutes = router;
