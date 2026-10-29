import express from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { Role } from "../../../generated/prisma/enums";
import { FlashSaleController } from "./flashSale.controller";
import { updateFlashSaleZodSchema } from "./flashSale.validation";

const router = express.Router();

router.get("/public", FlashSaleController.getPublicFlashSale);

router.get(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  FlashSaleController.getFlashSale,
);

router.put(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updateFlashSaleZodSchema),
  FlashSaleController.updateFlashSale,
);

export const FlashSaleRoutes = router;
