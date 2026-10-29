import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { SizeChartService } from "./sizeChart.service";

const createSizeChart = catchAsync(async (req: Request, res: Response) => {
  const result = await SizeChartService.createSizeChart(req);
  sendResponse(res, {
    httpStatusCode: 201,
    success: true,
    message: "Size chart created successfully",
    data: result,
  });
});

const getSizeCharts = catchAsync(async (req: Request, res: Response) => {
  const result = await SizeChartService.getSizeCharts();
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Size charts retrieved successfully",
    data: result,
  });
});

const updateSizeChart = catchAsync(async (req: Request, res: Response) => {
  const result = await SizeChartService.updateSizeChart(req.params.id as string, req);
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Size chart updated successfully",
    data: result,
  });
});

const deleteSizeChart = catchAsync(async (req: Request, res: Response) => {
  const result = await SizeChartService.deleteSizeChart(req.params.id as string);
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Size chart deleted successfully",
    data: result,
  });
});

export const SizeChartController = {
  createSizeChart,
  getSizeCharts,
  updateSizeChart,
  deleteSizeChart,
};
