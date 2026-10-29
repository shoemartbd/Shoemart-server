import { Request, Response, Router } from "express";
import { z } from "zod";
import { Role, WholesaleRequestStatus } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { wholesaleRequestRateLimiter } from "../../middleware/rateLimiter";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { WholesaleRequestService } from "./wholesaleRequest.service";

const createZodSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z.string().trim().min(1, "Phone number is required").max(20),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")).optional(),
  businessName: z.string().trim().max(150).optional(),
  businessType: z.string().trim().max(60).optional(),
  location: z.string().trim().max(150).optional(),
  categories: z.array(z.string().trim().max(80)).max(30).optional(),
  quantity: z.string().trim().max(60).optional(),
  message: z.string().trim().max(2000).optional(),
});

const updateZodSchema = z.object({
  status: z.enum(WholesaleRequestStatus).optional(),
  adminNote: z.string().trim().max(2000).optional(),
});

const router = Router();

// Public: the /wholesale landing page form
router.post(
  "/",
  wholesaleRequestRateLimiter,
  validateRequest(createZodSchema),
  catchAsync(async (req: Request, res: Response) => {
    const data = await WholesaleRequestService.createRequest(req.body);
    sendResponse(res, {
      httpStatusCode: 201,
      success: true,
      message: "Thanks! Our wholesale team will contact you soon.",
      data: { id: data.id },
    });
  }),
);

router.get(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  catchAsync(async (req: Request, res: Response) => {
    const data = await WholesaleRequestService.getRequests({
      status: req.query.status as string,
      searchTerm: req.query.searchTerm as string,
    });
    sendResponse(res, { httpStatusCode: 200, success: true, message: "Wholesale requests retrieved", data });
  }),
);

router.patch(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updateZodSchema),
  catchAsync(async (req: Request, res: Response) => {
    const data = await WholesaleRequestService.updateRequest(req.params.id as string, req.body);
    sendResponse(res, { httpStatusCode: 200, success: true, message: "Wholesale request updated", data });
  }),
);

router.delete(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  catchAsync(async (req: Request, res: Response) => {
    const data = await WholesaleRequestService.deleteRequest(req.params.id as string);
    sendResponse(res, { httpStatusCode: 200, success: true, message: "Wholesale request deleted", data });
  }),
);

export const WholesaleRequestRoutes = router;
