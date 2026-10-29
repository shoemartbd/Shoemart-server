import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AttributeController } from "./attribute.controller";
import {
  createAttributeZodSchema,
  updateAttributeZodSchema,
  addAttributeValueZodSchema,
} from "./attribute.validation";

const router = Router();

// Public routes
router.get("/", AttributeController.getAllAttributes);
router.get("/:id", AttributeController.getAttributeById);

// Admin protected routes
router.post(
  "/",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  validateRequest(createAttributeZodSchema),
  AttributeController.createAttribute
);

router.patch(
  "/:id",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  validateRequest(updateAttributeZodSchema),
  AttributeController.updateAttribute
);

router.delete(
  "/:id",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  AttributeController.deleteAttribute
);

router.post(
  "/:id/values",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  validateRequest(addAttributeValueZodSchema),
  AttributeController.addAttributeValue
);

router.delete(
  "/values/:valueId",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  AttributeController.deleteAttributeValue
);

router.patch(
  "/values/:valueId",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  validateRequest(addAttributeValueZodSchema),
  AttributeController.updateAttributeValue
);

export const AttributeRoutes = router;
