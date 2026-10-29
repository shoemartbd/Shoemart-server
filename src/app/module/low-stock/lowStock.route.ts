import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { LowStockController } from "./lowStock.controller";
import { updateStockZodSchema } from "./lowStock.validation";

const router = Router();

router.use(checkAuth(Role.ADMIN, Role.SUPER_ADMIN));

router.get("/", LowStockController.getLowStock);

router.patch(
  "/stock",
  validateRequest(updateStockZodSchema),
  LowStockController.updateStock,
);

export const LowStockRoutes = router;
