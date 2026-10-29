import express from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { multerUpload } from "../../config/multer.config";
import { TestimonialController } from "./testimonial.controller";

const router = express.Router();

router.get("/", TestimonialController.getTestimonials);

router.post(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.single("avatar"),
  TestimonialController.createTestimonial,
);

router.patch(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.single("avatar"),
  TestimonialController.updateTestimonial,
);

router.delete(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  TestimonialController.deleteTestimonial,
);

export const TestimonialRoutes = router;
