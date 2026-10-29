import { Request, Response } from "express";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CouponService } from "./coupon.service";

const createCoupon = catchAsync(async (req: Request, res: Response) => {
  const result = await CouponService.createCoupon(req.body);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Coupon created successfully",
    data: result,
  });
});

const getAllCoupons = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await CouponService.getAllCoupons(
    req.query as IQueryParams
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Coupons fetched successfully",
    data,
    meta,
  });
});

const getCouponById = catchAsync(async (req: Request, res: Response) => {
  const result = await CouponService.getCouponById(req.params.id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Coupon fetched successfully",
    data: result,
  });
});

const toggleCouponStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await CouponService.toggleCouponStatus(req.params.id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Coupon status updated",
    data: result,
  });
});

const deleteCoupon = catchAsync(async (req: Request, res: Response) => {
  const result = await CouponService.deleteCoupon(req.params.id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

const validateCoupon = catchAsync(async (req: Request, res: Response) => {
  const result = await CouponService.validateCoupon(req.body);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Coupon applied successfully",
    data: result,
  });
});

export const CouponController = {
  createCoupon,
  getAllCoupons,
  getCouponById,
  toggleCouponStatus,
  deleteCoupon,
  validateCoupon,
};
