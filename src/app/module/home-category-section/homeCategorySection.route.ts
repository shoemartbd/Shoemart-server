import express from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { Role } from "../../../generated/prisma/enums";
import { HomeCategorySectionController } from "./homeCategorySection.controller";
import { updateHomeCategorySectionsZodSchema } from "./homeCategorySection.validation";

const router = express.Router();

router.get("/homepage", HomeCategorySectionController.getHomepageSections);

router.get(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  HomeCategorySectionController.getHomeCategorySections,
);

router.put(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updateHomeCategorySectionsZodSchema),
  HomeCategorySectionController.updateHomeCategorySections,
);

export const HomeCategorySectionRoutes = router;
