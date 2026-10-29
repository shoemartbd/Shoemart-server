import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ReviewController } from "./review.controller";
import {
  createReviewZodSchema,
} from "./review.validation";

const router = Router();

router.get("/product/:productId", ReviewController.getProductReviews);

router.get(
  "/my-reviews",
  checkAuth(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  ReviewController.getMyReviews,
);

router.post(
  "/",
  checkAuth(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(createReviewZodSchema),
  ReviewController.createReview,
);

router.delete(
  "/:id",
  checkAuth(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  ReviewController.deleteReview,
);

export const ReviewRoutes = router;
