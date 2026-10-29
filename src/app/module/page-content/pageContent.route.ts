import express from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { Role } from "../../../generated/prisma/enums";
import { PageContentController } from "./pageContent.controller";
import { updatePageContentZodSchema } from "./pageContent.validation";

const router = express.Router();

router.get("/:slug", PageContentController.getPageContent);

router.put(
  "/:slug",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updatePageContentZodSchema),
  PageContentController.updatePageContent,
);

export const PageContentRoutes = router;
