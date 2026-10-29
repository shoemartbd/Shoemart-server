import express from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { multerUpload } from "../../config/multer.config";
import { HeroSliderController } from "./heroSlider.controller";

const router = express.Router();

router.get("/", HeroSliderController.getHeroSliders);

router.post(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.single("image"),
  HeroSliderController.createHeroSlider
);

router.delete(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  HeroSliderController.deleteHeroSlider
);

export const HeroSliderRoutes = router;
