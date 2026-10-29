import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CustomerSegmentReportService } from "./customerSegmentReport.service";

const getOverview = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const result = await CustomerSegmentReportService.getCustomerSegmentOverview({
    startDate,
    endDate,
  });

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Customer segment report overview fetched successfully",
    data: result,
  });
});

export const CustomerSegmentReportController = {
  getOverview,
};
