import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ShippingSettingService } from "./shippingSetting.service";

const getShippingSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await ShippingSettingService.getShippingSettings();

  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Shipping settings retrieved successfully",
    data: result,
  });
});

const updateShippingSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await ShippingSettingService.updateShippingSettings(req.body);

  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Shipping settings updated successfully",
    data: result,
  });
});

export const ShippingSettingController = {
  getShippingSettings,
  updateShippingSettings,
};
