import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { HeroSliderService } from "./heroSlider.service";

const createHeroSlider = catchAsync(async (req: Request, res: Response) => {
  const result = await HeroSliderService.createHeroSlider(req);
  sendResponse(res, {
    httpStatusCode: 201,
    success: true,
    message: "Hero slider created successfully",
    data: result,
  });
});

const getHeroSliders = catchAsync(async (req: Request, res: Response) => {
  const result = await HeroSliderService.getHeroSliders();
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Hero sliders retrieved successfully",
    data: result,
  });
});

const deleteHeroSlider = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await HeroSliderService.deleteHeroSlider(id as string);
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Hero slider deleted successfully",
    data: result,
  });
});

export const HeroSliderController = {
  createHeroSlider,
  getHeroSliders,
  deleteHeroSlider,
};
