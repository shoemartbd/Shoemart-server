import { Router, Request, NextFunction, Response } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { multerUpload } from "../../config/multer.config";
import { SiteSettingController } from "./siteSetting.controller";
import { updateSiteSettingZodSchema } from "./siteSetting.validation";

const router = Router();

router.get("/", SiteSettingController.getSiteSettings);

router.patch(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.single("logo"),
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    next();
  },
  validateRequest(updateSiteSettingZodSchema),
  SiteSettingController.updateSiteSettings,
);

export const SiteSettingRoutes = router;
