import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { HomePromoService } from "./homePromo.service";

const getHomePromo = catchAsync(async (req: Request, res: Response) => {
  const result = await HomePromoService.getHomePromo();
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Home promo retrieved successfully",
    data: result,
  });
});

const updateHomePromo = catchAsync(async (req: Request, res: Response) => {
  const result = await HomePromoService.updateHomePromo(req);
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Home promo updated successfully",
    data: result,
  });
});

export const HomePromoController = { getHomePromo, updateHomePromo };
