import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { FaqService } from "./faq.service";

const getFaqs = catchAsync(async (req: Request, res: Response) => {
  const result = await FaqService.getFaqs();
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Faqs retrieved successfully",
    data: result,
  });
});

const getPublicFaqs = catchAsync(async (req: Request, res: Response) => {
  const result = await FaqService.getPublicFaqs();
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Faqs retrieved successfully",
    data: result,
  });
});

const updateFaqs = catchAsync(async (req: Request, res: Response) => {
  const { faqs } = req.body;
  const result = await FaqService.replaceFaqs(faqs);
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Faqs updated successfully",
    data: result,
  });
});

export const FaqController = {
  getFaqs,
  getPublicFaqs,
  updateFaqs,
};
