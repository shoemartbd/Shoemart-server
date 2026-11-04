import { Request, Response, Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { multerUpload } from "../../config/multer.config";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { WholesaleProductService } from "./wholesaleProduct.service";

const router = Router();

// Main photos + one optional photo per colour
const upload = multerUpload.fields([
  { name: "images", maxCount: 8 },
  { name: "colorImages", maxCount: 30 },
]);

// Public: wholesale page "Product View"
router.get(
  "/gallery",
  catchAsync(async (_req: Request, res: Response) => {
    const data = await WholesaleProductService.getGallery();
    sendResponse(res, { httpStatusCode: 200, success: true, message: "Wholesale gallery retrieved", data });
  }),
);

router.get(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  catchAsync(async (req: Request, res: Response) => {
    const data = await WholesaleProductService.getProducts({
      searchTerm: req.query.searchTerm as string,
      categoryId: req.query.categoryId as string,
    });
    sendResponse(res, { httpStatusCode: 200, success: true, message: "Wholesale products retrieved", data });
  }),
);

router.post(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  upload,
  catchAsync(async (req: Request, res: Response) => {
    const data = await WholesaleProductService.createProduct(req);
    sendResponse(res, { httpStatusCode: 201, success: true, message: "Wholesale product added", data });
  }),
);

router.patch(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  upload,
  catchAsync(async (req: Request, res: Response) => {
    const data = await WholesaleProductService.updateProduct(req.params.id as string, req);
    sendResponse(res, { httpStatusCode: 200, success: true, message: "Wholesale product updated", data });
  }),
);

router.delete(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  catchAsync(async (req: Request, res: Response) => {
    const data = await WholesaleProductService.deleteProduct(req.params.id as string);
    sendResponse(res, { httpStatusCode: 200, success: true, message: "Wholesale product deleted", data });
  }),
);

export const WholesaleProductRoutes = router;
