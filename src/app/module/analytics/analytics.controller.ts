import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { AnalyticsService } from "./analytics.service";

const getAdminAnalytics = catchAsync(async (req: Request, res: Response) => {
  const result = await AnalyticsService.getAdminAnalytics();

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Admin analytics fetched successfully",
    data: result,
  });
});

const getUserAnalytics = catchAsync(async (req: Request, res: Response) => {
  const result = await AnalyticsService.getUserAnalytics(
    req.user.userId as string,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "User analytics fetched successfully",
    data: result,
  });
});

export const AnalyticsController = {
  getAdminAnalytics,
  getUserAnalytics,
};
