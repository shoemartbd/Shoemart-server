import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CourierSettingService } from "./courierSetting.service";

const getCourierSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await CourierSettingService.getCourierSettings();

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Courier settings retrieved successfully",
    data: result,
  });
});

const updatePathaoSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await CourierSettingService.updatePathaoSettings(req.body);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Pathao settings updated successfully",
    data: result,
  });
});

const updateSteadfastSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await CourierSettingService.updateSteadfastSettings(req.body);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Steadfast settings updated successfully",
    data: result,
  });
});

const updateRedxSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await CourierSettingService.updateRedxSettings(req.body);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "RedX settings updated successfully",
    data: result,
  });
});

export const CourierSettingController = {
  updateRedxSettings,
  getCourierSettings,
  updatePathaoSettings,
  updateSteadfastSettings,
};
