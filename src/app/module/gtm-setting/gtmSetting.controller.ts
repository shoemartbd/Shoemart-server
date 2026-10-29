import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { GtmSettingService } from "./gtmSetting.service";

const getPublicGtmSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await GtmSettingService.getPublicGtmSettings();
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "GTM settings retrieved successfully",
    data: result,
  });
});

const getGtmSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await GtmSettingService.getGtmSettings();
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "GTM settings retrieved successfully",
    data: result,
  });
});

const updateGtmSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await GtmSettingService.updateGtmSettings(req.body);
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "GTM settings updated successfully",
    data: result,
  });
});

export const GtmSettingController = {
  getPublicGtmSettings,
  getGtmSettings,
  updateGtmSettings,
};
