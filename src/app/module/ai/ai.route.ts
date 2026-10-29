import express from "express";
import { AIController } from "./ai.controller";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = express.Router();

router.post(
  "/generate-product-data",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  AIController.generateProductData,
);

// Public route — no auth needed, called from product detail pages
router.post("/recommendations", AIController.getRecommendations);

router.post(
  "/analyze-business",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  AIController.analyzeBusiness,
);

export const AIRoutes = router;
