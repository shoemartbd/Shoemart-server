import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { FlashSaleService } from "./flashSale.service";

const getFlashSale = catchAsync(async (req: Request, res: Response) => {
  const result = await FlashSaleService.getFlashSale();

  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Flash sale retrieved successfully",
    data: result,
  });
});

const updateFlashSale = catchAsync(async (req: Request, res: Response) => {
  const result = await FlashSaleService.replaceFlashSale(req.body);

  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Flash sale updated successfully",
    data: result,
  });
});

const getPublicFlashSale = catchAsync(async (req: Request, res: Response) => {
  const result = await FlashSaleService.getPublicFlashSale();

  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Flash sale retrieved successfully",
    data: result,
  });
});

export const FlashSaleController = {
  getFlashSale,
  updateFlashSale,
  getPublicFlashSale,
};
