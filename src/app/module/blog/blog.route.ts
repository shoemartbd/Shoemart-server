import { Router, Request, Response, NextFunction } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { BlogController } from "./blog.controller";
import {
  createBlogZodSchema,
  updateBlogZodSchema,
} from "./blog.validation";
import { multerUpload } from "../../config/multer.config";

const router = Router();

// Public routes
router.get("/", BlogController.getAllBlogs);

// Admin routes (must be declared before "/:id" to avoid being swallowed by the param route)
router.get(
  "/admin",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  BlogController.getAllBlogsAdmin,
);

router.get("/slug/:slug", BlogController.getBlogBySlug);

router.get(
  "/:id",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  BlogController.getBlogById,
);

// Admin only routes
router.post(
  "/",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  multerUpload.single("coverImage"),
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    next();
  },
  validateRequest(createBlogZodSchema),
  BlogController.createBlog,
);

router.patch(
  "/:id",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  multerUpload.single("coverImage"),
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    next();
  },
  validateRequest(updateBlogZodSchema),
  BlogController.updateBlog,
);

router.delete(
  "/:id",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  BlogController.deleteBlog,
);

export const BlogRoutes = router;
