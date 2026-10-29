import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IQueryParams } from "../../interfaces/query.interface";
import { OrderReturnService } from "./orderReturn.service";

const processOrderReturn = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderReturnService.processOrderReturn(
    req.body,
    req.user.userId as string,
  );

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Return processed and order updated successfully",
    data: result,
  });
});

const getAllOrderReturns = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await OrderReturnService.getAllOrderReturns(
    req.query as IQueryParams,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Order returns fetched successfully",
    data,
    meta,
  });
});

const getReturnsByOrderId = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderReturnService.getReturnsByOrderId(
    req.params.orderId as string,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Order returns fetched successfully",
    data: result,
  });
});

export const OrderReturnController = {
  processOrderReturn,
  getAllOrderReturns,
  getReturnsByOrderId,
};
