import express from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { multerUpload } from "../../config/multer.config";
import { HomePromoController } from "./homePromo.controller";

const router = express.Router();

router.get("/", HomePromoController.getHomePromo);

router.patch(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.fields([
    { name: "bannerImage", maxCount: 1 },
    { name: "productsBannerImage", maxCount: 1 },
  ]),
  HomePromoController.updateHomePromo,
);

export const HomePromoRoutes = router;
