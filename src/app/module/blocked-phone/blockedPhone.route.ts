import { Request, Response, Router } from "express";
import { z } from "zod";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { BlockedPhoneService } from "./blockedPhone.service";

const blockPhoneZodSchema = z
  .object({
    phone: z.string().trim().optional(),
    orderId: z.string().uuid().optional(),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.phone || v.orderId, { message: "Phone number or order is required" });

const router = Router();

router.use(checkAuth(Role.ADMIN, Role.SUPER_ADMIN));

router.get(
  "/",
  catchAsync(async (req: Request, res: Response) => {
    const data = await BlockedPhoneService.getBlockedPhones(req.query.searchTerm as string);
    sendResponse(res, { httpStatusCode: 200, success: true, message: "Blocked numbers retrieved", data });
  }),
);

router.post(
  "/",
  validateRequest(blockPhoneZodSchema),
  catchAsync(async (req: Request, res: Response) => {
    const data = await BlockedPhoneService.blockPhone(req.body, req.user);
    sendResponse(res, { httpStatusCode: 201, success: true, message: `${data.phone} is blocked`, data });
  }),
);

router.delete(
  "/:id",
  catchAsync(async (req: Request, res: Response) => {
    const data = await BlockedPhoneService.unblockPhone(req.params.id as string);
    sendResponse(res, { httpStatusCode: 200, success: true, message: `${data.phone} is unblocked`, data });
  }),
);

export const BlockedPhoneRoutes = router;
