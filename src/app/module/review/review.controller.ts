import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ReviewService } from "./review.service";

const createReview = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.createReview(
    req.user.userId as string,
    req.body,
  );

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Review submitted successfully",
    data: result,
  });
});

const getProductReviews = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.getProductReviews(
    req.params.productId as string,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Reviews fetched successfully",
    data: result,
  });
});

const getMyReviews = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.getMyReviews(req.user.userId as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Your reviews fetched successfully",
    data: result,
  });
});

const deleteReview = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.deleteReview(
    req.user.userId as string,
    req.params.id as string,
    req.user.role as string,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

export const ReviewController = {
  createReview,
  getProductReviews,
  deleteReview,
  getMyReviews,
};
