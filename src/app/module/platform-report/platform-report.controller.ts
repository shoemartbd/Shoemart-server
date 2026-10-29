import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { PlatformReportService } from "./platform-report.service";

const getPlatformSummary = catchAsync(async (req: Request, res: Response) => {
  const result = await PlatformReportService.getPlatformSummary();

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Platform summary fetched successfully",
    data: result,
  });
});

const getPlatformOverview = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const result = await PlatformReportService.getPlatformOverview({ startDate, endDate });

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Platform overview fetched successfully",
    data: result,
  });
});

const getPlatformItems = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate, orderType } = req.query as {
    startDate?: string;
    endDate?: string;
    orderType?: string;
  };
  const result = await PlatformReportService.getPlatformItems({
    startDate,
    endDate,
    orderType,
  });

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Platform report items fetched successfully",
    data: result,
  });
});

export const PlatformReportController = {
  getPlatformSummary,
  getPlatformOverview,
  getPlatformItems,
};
