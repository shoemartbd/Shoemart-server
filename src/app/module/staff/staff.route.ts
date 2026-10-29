import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { StaffController } from "./staff.controller";
import {
  createRoleZodSchema,
  createStaffZodSchema,
  updateRoleZodSchema,
  updateStaffZodSchema,
} from "./staff.validation";

const router = Router();

// Full admins and super admins only: staff accounts are refused here by the
// permission map in checkAuth, so they can never widen their own access
router.use(checkAuth(Role.ADMIN, Role.SUPER_ADMIN));

router.get("/permissions", StaffController.getPermissions);

router.get("/roles", StaffController.getRoles);
router.post("/roles", validateRequest(createRoleZodSchema), StaffController.createRole);
router.patch("/roles/:id", validateRequest(updateRoleZodSchema), StaffController.updateRole);
router.delete("/roles/:id", StaffController.deleteRole);

router.get("/users", StaffController.getStaff);
router.post("/users", validateRequest(createStaffZodSchema), StaffController.createStaff);
router.patch("/users/:id", validateRequest(updateStaffZodSchema), StaffController.updateStaff);
router.delete("/users/:id", StaffController.deleteStaff);

export const StaffRoutes = router;
