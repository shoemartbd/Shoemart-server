import { Router, Request, Response, NextFunction } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth, optionalAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { multerUpload } from "../../config/multer.config";
import { guestOrderRateLimiter } from "../../middleware/rateLimiter";
import { LandingPageController } from "./landingPage.controller";
import {
  createGuestLandingOrderZodSchema,
  createLandingPageZodSchema,
  updateLandingPageZodSchema,
} from "./landingPage.validation";

const router = Router();

const landingPageFileFields = multerUpload.fields([
  { name: "bannerImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 10 },
  { name: "reviewImages", maxCount: 10 },
]);

const parseJsonBody = (req: Request, res: Response, next: NextFunction) => {
  if (req.body.data) {
    req.body = JSON.parse(req.body.data);
  }
  next();
};

// ADMIN routes
router.post(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  landingPageFileFields,
  parseJsonBody,
  validateRequest(createLandingPageZodSchema),
  LandingPageController.createLandingPage,
);

router.get(
  "/my-landing-pages",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  LandingPageController.getMyLandingPages,
);

router.get(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  LandingPageController.getLandingPageById,
);

router.patch(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  landingPageFileFields,
  parseJsonBody,
  validateRequest(updateLandingPageZodSchema),
  LandingPageController.updateLandingPage,
);

router.delete(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  LandingPageController.deleteLandingPage,
);

// Public routes — powers the public /lp/[slug] page, no login required
router.get("/slug/:slug", LandingPageController.getLandingPageBySlug);

router.post(
  "/slug/:slug/order",
  guestOrderRateLimiter,
  // Logged-in customers get the order on their account; guests are allowed
  // only while guest checkout is on (Dashboard → Site Settings)
  optionalAuth(),
  validateRequest(createGuestLandingOrderZodSchema),
  LandingPageController.createGuestOrder,
);

export const LandingPageRoutes = router;
