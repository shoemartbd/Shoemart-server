import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { SiteSettingService } from "./siteSetting.service";

const getSiteSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await SiteSettingService.getSiteSettings();

  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Site settings retrieved successfully",
    data: result,
  });
});

const updateSiteSettings = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };

  if (req.file) {
    payload.logo = (req.file as Express.Multer.File).path;
  }

  const result = await SiteSettingService.updateSiteSettings(payload);

  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Site settings updated successfully",
    data: result,
  });
});

export const SiteSettingController = {
  getSiteSettings,
  updateSiteSettings,
};
