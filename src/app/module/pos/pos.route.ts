import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PosController } from "./pos.controller";
import {
  addToPosCartZodSchema,
  updatePosCartItemZodSchema,
  createPosOrderZodSchema,
} from "./pos.validation";

const router = Router();

// All routes are for ADMIN only
router.use(checkAuth(Role.ADMIN, Role.SUPER_ADMIN));

router.get("/products", PosController.getShopProducts);

router.get("/cart", PosController.getPosCart);
router.post(
  "/cart",
  validateRequest(addToPosCartZodSchema),
  PosController.addToPosCart
);
router.patch(
  "/cart/:id",
  validateRequest(updatePosCartItemZodSchema),
  PosController.updatePosCartItem
);
router.delete("/cart/:id", PosController.deletePosCartItem);
router.delete("/cart", PosController.clearPosCart);

router.post(
  "/orders",
  validateRequest(createPosOrderZodSchema),
  PosController.createPosOrder
);
router.get("/orders", PosController.getPosOrders);

export const PosRoutes = router;
