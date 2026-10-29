import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { DistrictReportService } from "./districtReport.service";

const getOverview = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const result = await DistrictReportService.getDistrictReportOverview({ startDate, endDate });

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "District report overview fetched successfully",
    data: result,
  });
});

export const DistrictReportController = {
  getOverview,
};
