import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { PageContentService } from "./pageContent.service";

const getPageContent = catchAsync(async (req: Request, res: Response) => {
  const result = await PageContentService.getPageContent(
    req.params.slug as string,
  );
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Page content retrieved successfully",
    data: result,
  });
});

const updatePageContent = catchAsync(async (req: Request, res: Response) => {
  const { title, content } = req.body;
  const result = await PageContentService.upsertPageContent(
    req.params.slug as string,
    { title, content },
  );
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Page content updated successfully",
    data: result,
  });
});

export const PageContentController = {
  getPageContent,
  updatePageContent,
};
