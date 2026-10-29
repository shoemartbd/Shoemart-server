import express from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { multerUpload } from "../../config/multer.config";
import { PopupController } from "./popup.controller";

const router = express.Router();

// Public: the popup the storefront should show (or null)
router.get("/active", PopupController.getActivePopup);

router.get(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PopupController.getPopups,
);

router.post(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.single("image"),
  PopupController.createPopup,
);

router.patch(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.single("image"),
  PopupController.updatePopup,
);

router.delete(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PopupController.deletePopup,
);

export const PopupRoutes = router;
