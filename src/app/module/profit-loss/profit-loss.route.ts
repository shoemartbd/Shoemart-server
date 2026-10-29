import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { ProfitLossController } from "./profit-loss.controller";

const router = Router();

router.use(checkAuth(Role.ADMIN, Role.SUPER_ADMIN));

router.get("/summary", ProfitLossController.getProfitLossSummary);
router.get("/items", ProfitLossController.getProfitLossItems);

export const ProfitLossRoutes = router;
