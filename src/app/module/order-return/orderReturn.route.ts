import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { OrderReturnController } from "./orderReturn.controller";
import { processOrderReturnZodSchema } from "./orderReturn.validation";

const router = Router();

router.use(checkAuth(Role.ADMIN, Role.SUPER_ADMIN));

router.post(
  "/",
  validateRequest(processOrderReturnZodSchema),
  OrderReturnController.processOrderReturn,
);

router.get("/", OrderReturnController.getAllOrderReturns);

router.get("/order/:orderId", OrderReturnController.getReturnsByOrderId);

export const OrderReturnRoutes = router;
