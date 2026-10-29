import { Router, Request, Response, NextFunction } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ProductController } from "./product.controller";
import {
  createProductZodSchema,
  updateProductZodSchema,
  bulkDeleteProductZodSchema,
} from "./product.validation";
import { multerUpload } from "../../config/multer.config";

const router = Router();

// Public routes
router.get("/", ProductController.getAllProducts);

// Admin routes (must be declared before "/:id" to avoid being swallowed by the param route)
router.get(
  "/generate-sku",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  ProductController.generateSku,
);

// Delete the products selected in the admin list
router.post(
  "/bulk-delete",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(bulkDeleteProductZodSchema),
  ProductController.bulkDeleteProducts,
);

router.get("/:id", ProductController.getProductById);
router.get("/slug/:slug", ProductController.getProductBySlug);

// Admin routes
router.post(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.array("images", 5), // allow up to 5 images
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    next();
  },
  validateRequest(createProductZodSchema),
  ProductController.createProduct,
);

router.patch(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.array("images", 5),
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    next();
  },
  validateRequest(updateProductZodSchema),
  ProductController.updateProduct,
);

router.delete(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  ProductController.deleteProduct,
);

// Variant-specific routes
router.get(
  "/:id/variants",
  ProductController.getProductVariants,
);

router.patch(
  "/:productId/variants/:variantId/image",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.single("image"),
  ProductController.uploadVariantImage,
);

export const ProductRoutes = router;
