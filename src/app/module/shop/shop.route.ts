import { Router, Request, Response, NextFunction } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ShopController } from "./shop.controller";
import { updateStoreZodSchema } from "./shop.validation";
import { multerUpload } from "../../config/multer.config";

const router = Router();

// Public — storefront branding (name/logo/banner/description)
router.get("/", ShopController.getStore);

router.patch(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    next();
  },
  validateRequest(updateStoreZodSchema),
  ShopController.updateStore,
);

export const ShopRoutes = router;
