import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { PaymentSettingService } from "./paymentSetting.service";

const getPublicPaymentSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentSettingService.getPublicPaymentSettings();

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Payment methods retrieved successfully",
    data: result,
  });
});

// Admin only — includes gateway credentials
const getPaymentSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentSettingService.getPaymentSettings();

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Payment settings retrieved successfully",
    data: result,
  });
});

const updateCodSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentSettingService.updateCodSettings(req.body);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "COD settings updated successfully",
    data: result,
  });
});

const updateSslcommerzSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentSettingService.updateSslcommerzSettings(req.body);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "SSLCommerz settings updated successfully",
    data: result,
  });
});

const updateBkashSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentSettingService.updateBkashSettings(req.body);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "bKash settings updated successfully",
    data: result,
  });
});

export const PaymentSettingController = {
  getPublicPaymentSettings,
  getPaymentSettings,
  updateBkashSettings,
  updateCodSettings,
  updateSslcommerzSettings,
};
