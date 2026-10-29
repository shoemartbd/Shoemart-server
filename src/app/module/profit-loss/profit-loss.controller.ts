import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ProfitLossService } from "./profit-loss.service";

const getProfitLossSummary = catchAsync(async (req: Request, res: Response) => {
  const result = await ProfitLossService.getProfitLossSummary();

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Profit & loss summary fetched successfully",
    data: result,
  });
});

const getProfitLossItems = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const result = await ProfitLossService.getProfitLossItems({
    startDate,
    endDate,
  });

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Profit & loss report fetched successfully",
    data: result,
  });
});

export const ProfitLossController = {
  getProfitLossSummary,
  getProfitLossItems,
};
