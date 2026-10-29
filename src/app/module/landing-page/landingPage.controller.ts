import { Request, Response } from "express";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { LandingPageService } from "./landingPage.service";

type MulterFiles = { [fieldname: string]: Express.Multer.File[] };

const createLandingPage = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };

  if (req.files && typeof req.files === "object") {
    const files = req.files as MulterFiles;
    if (files.bannerImage?.[0]) {
      payload.bannerImage = files.bannerImage[0].path;
    }
    if (files.galleryImages?.length) {
      payload.galleryImages = files.galleryImages.map((f) => f.path);
    }
    if (files.reviewImages?.length) {
      payload.reviewImages = files.reviewImages.map((f) => f.path);
    }
  }

  const result = await LandingPageService.createLandingPage(payload);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Landing page created successfully",
    data: result,
  });
});

const getMyLandingPages = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await LandingPageService.getMyLandingPages(
    req.query as IQueryParams,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Landing pages retrieved successfully",
    data,
    meta,
  });
});

const getLandingPageById = catchAsync(async (req: Request, res: Response) => {
  const result = await LandingPageService.getLandingPageById(
    req.params.id as string,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Landing page retrieved successfully",
    data: result,
  });
});

const getLandingPageBySlug = catchAsync(async (req: Request, res: Response) => {
  const result = await LandingPageService.getLandingPageBySlug(req.params.slug as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Landing page retrieved successfully",
    data: result,
  });
});

const updateLandingPage = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };

  if (req.files && typeof req.files === "object") {
    const files = req.files as MulterFiles;
    if (files.bannerImage?.[0]) {
      payload.bannerImage = files.bannerImage[0].path;
    }
    if (files.galleryImages?.length) {
      const uploaded = files.galleryImages.map((f) => f.path);
      payload.galleryImages = [...(payload.galleryImages || []), ...uploaded];
    }
    if (files.reviewImages?.length) {
      const uploaded = files.reviewImages.map((f) => f.path);
      payload.reviewImages = [...(payload.reviewImages || []), ...uploaded];
    }
  }

  const result = await LandingPageService.updateLandingPage(
    req.params.id as string,
    payload,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Landing page updated successfully",
    data: result,
  });
});

const deleteLandingPage = catchAsync(async (req: Request, res: Response) => {
  const result = await LandingPageService.deleteLandingPage(
    req.params.id as string,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

const createGuestOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await LandingPageService.createGuestOrder(
    req.params.slug as string,
    req.body,
    req.user?.userId ?? null,
  );

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Order placed successfully",
    data: result,
  });
});

export const LandingPageController = {
  createLandingPage,
  getMyLandingPages,
  getLandingPageById,
  getLandingPageBySlug,
  updateLandingPage,
  deleteLandingPage,
  createGuestOrder,
};
