import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import status from "http-status";
import { AIService } from "./ai.service";

const generateProductData = catchAsync(async (req: Request, res: Response) => {
  const { title } = req.body;
  const result = await AIService.generateProductData(title);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Product data generated successfully",
    data: result,
  });
});

const getRecommendations = catchAsync(async (req: Request, res: Response) => {
  const { productId } = req.body;
  const result = await AIService.getRecommendations(productId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Recommendations fetched successfully",
    data: result,
  });
});

const analyzeBusiness = catchAsync(async (req: Request, res: Response) => {
  const result = await AIService.analyzeBusiness();

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Business insights generated successfully",
    data: result,
  });
});

export const AIController = {
  generateProductData,
  getRecommendations,
  analyzeBusiness,
};
