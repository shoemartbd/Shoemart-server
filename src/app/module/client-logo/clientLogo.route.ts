import express from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { multerUpload } from "../../config/multer.config";
import { ClientLogoController } from "./clientLogo.controller";

const router = express.Router();

router.get("/", ClientLogoController.getClientLogos);

router.post(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.single("logo"),
  ClientLogoController.createClientLogo,
);

router.patch(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.single("logo"),
  ClientLogoController.updateClientLogo,
);

router.delete(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  ClientLogoController.deleteClientLogo,
);

export const ClientLogoRoutes = router;
