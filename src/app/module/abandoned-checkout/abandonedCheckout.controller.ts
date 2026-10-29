import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IQueryParams } from "../../interfaces/query.interface";
import { AbandonedCheckoutService } from "./abandonedCheckout.service";

const trackCheckout = catchAsync(async (req: Request, res: Response) => {
  const result = await AbandonedCheckoutService.trackCheckout(req.body);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Checkout progress saved",
    data: result,
  });
});

const getAbandonedCheckouts = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await AbandonedCheckoutService.getAbandonedCheckouts(
    req.query as IQueryParams,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Abandoned checkouts fetched successfully",
    data,
    meta,
  });
});

const deleteAbandonedCheckout = catchAsync(async (req: Request, res: Response) => {
  const result = await AbandonedCheckoutService.deleteAbandonedCheckout(
    req.params.id as string,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Abandoned checkout deleted successfully",
    data: result,
  });
});

export const AbandonedCheckoutController = {
  trackCheckout,
  getAbandonedCheckouts,
  deleteAbandonedCheckout,
};
