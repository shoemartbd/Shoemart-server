import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { HomeCategorySectionService } from "./homeCategorySection.service";

const getHomeCategorySections = catchAsync(
  async (req: Request, res: Response) => {
    const result = await HomeCategorySectionService.getHomeCategorySections();
    sendResponse(res, {
      httpStatusCode: 200,
      success: true,
      message: "Home category sections retrieved successfully",
      data: result,
    });
  },
);

const updateHomeCategorySections = catchAsync(
  async (req: Request, res: Response) => {
    const { sections } = req.body;
    const result =
      await HomeCategorySectionService.replaceHomeCategorySections(sections);
    sendResponse(res, {
      httpStatusCode: 200,
      success: true,
      message: "Home category sections updated successfully",
      data: result,
    });
  },
);

const getHomepageSections = catchAsync(
  async (req: Request, res: Response) => {
    const parsedLimit = Number(req.query.limit);
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 8;

    const result = await HomeCategorySectionService.getHomepageSections(
      limit,
    );
    sendResponse(res, {
      httpStatusCode: 200,
      success: true,
      message: "Homepage category sections retrieved successfully",
      data: result,
    });
  },
);

export const HomeCategorySectionController = {
  getHomeCategorySections,
  updateHomeCategorySections,
  getHomepageSections,
};
