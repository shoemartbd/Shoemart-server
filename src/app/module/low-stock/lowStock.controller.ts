import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IQueryParams } from "../../interfaces/query.interface";
import { LowStockService } from "./lowStock.service";

const getLowStock = catchAsync(async (req: Request, res: Response) => {
  const result = await LowStockService.getLowStock(req.query as IQueryParams);
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Low stock products retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const updateStock = catchAsync(async (req: Request, res: Response) => {
  const result = await LowStockService.updateStock(req.body);
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Stock updated successfully",
    data: result,
  });
});

export const LowStockController = { getLowStock, updateStock };
