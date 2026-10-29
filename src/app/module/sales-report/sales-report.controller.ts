import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { SalesReportService } from "./sales-report.service";

const getSalesSummary = catchAsync(async (req: Request, res: Response) => {
  const result = await SalesReportService.getSalesSummary();

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Sales summary fetched successfully",
    data: result,
  });
});

const getSalesReportItems = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const result = await SalesReportService.getSalesReportItems({
    startDate,
    endDate,
  });

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Sales report fetched successfully",
    data: result,
  });
});

export const SalesReportController = {
  getSalesSummary,
  getSalesReportItems,
};
