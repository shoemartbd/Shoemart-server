import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { SmsSettingService } from "./smsSetting.service";

const getSmsSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await SmsSettingService.getSmsSettings();

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "SMS settings retrieved successfully",
    data: result,
  });
});

const updateSmsSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await SmsSettingService.updateSmsSettings(req.body);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "SMS settings updated successfully",
    data: result,
  });
});

export const SmsSettingController = {
  getSmsSettings,
  updateSmsSettings,
};
