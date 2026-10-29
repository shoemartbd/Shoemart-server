import express from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { Role } from "../../../generated/prisma/enums";
import { FaqController } from "./faq.controller";
import { updateFaqsZodSchema } from "./faq.validation";

const router = express.Router();

router.get("/public", FaqController.getPublicFaqs);

router.get(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  FaqController.getFaqs,
);

router.put(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updateFaqsZodSchema),
  FaqController.updateFaqs,
);

export const FaqRoutes = router;
