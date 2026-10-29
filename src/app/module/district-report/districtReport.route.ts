import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { DistrictReportController } from "./districtReport.controller";

const router = Router();

router.use(checkAuth(Role.ADMIN, Role.SUPER_ADMIN));

router.get("/overview", DistrictReportController.getOverview);

export const DistrictReportRoutes = router;
