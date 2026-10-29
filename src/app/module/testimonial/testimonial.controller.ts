import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { TestimonialService } from "./testimonial.service";

const createTestimonial = catchAsync(async (req: Request, res: Response) => {
  const result = await TestimonialService.createTestimonial(req);
  sendResponse(res, {
    httpStatusCode: 201,
    success: true,
    message: "Testimonial created successfully",
    data: result,
  });
});

const getTestimonials = catchAsync(async (req: Request, res: Response) => {
  const result = await TestimonialService.getTestimonials(req.query.all === "true");
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Testimonials retrieved successfully",
    data: result,
  });
});

const updateTestimonial = catchAsync(async (req: Request, res: Response) => {
  const result = await TestimonialService.updateTestimonial(
    req.params.id as string,
    req,
  );
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Testimonial updated successfully",
    data: result,
  });
});

const deleteTestimonial = catchAsync(async (req: Request, res: Response) => {
  const result = await TestimonialService.deleteTestimonial(req.params.id as string);
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Testimonial deleted successfully",
    data: result,
  });
});

export const TestimonialController = {
  createTestimonial,
  getTestimonials,
  updateTestimonial,
  deleteTestimonial,
};
