import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CartController } from "./cart.controller";
import { addToCartZodSchema, updateCartItemZodSchema } from "./cart.validation";

const router = Router();

// All cart routes require authentication
router.use(checkAuth(Role.USER, Role.ADMIN, Role.SUPER_ADMIN));

router.get("/", CartController.getCart);

router.post(
  "/add",
  validateRequest(addToCartZodSchema),
  CartController.addToCart,
);

router.patch(
  "/update",
  validateRequest(updateCartItemZodSchema),
  CartController.updateCartItemQuantity,
);

router.delete("/remove/:productId", CartController.removeFromCart);

router.delete("/clear", CartController.clearCart);

export const CartRoutes = router;
