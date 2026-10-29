import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ShopService } from "./shop.service";

const getStore = catchAsync(async (req: Request, res: Response) => {
  const result = await ShopService.getDefaultShop();

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Store details fetched successfully",
    data: result,
  });
});

const updateStore = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };

  if (req.files && typeof req.files === "object") {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files.logo && files.logo[0]) {
      payload.logo = files.logo[0].path;
    }
    if (files.banner && files.banner[0]) {
      payload.banner = files.banner[0].path;
    }
  }

  const result = await ShopService.updateStore(payload);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Store updated successfully",
    data: result,
  });
});

export const ShopController = {
  getStore,
  updateStore,
};
