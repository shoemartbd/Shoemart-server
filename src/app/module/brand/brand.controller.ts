import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { BrandService } from "./brand.service";

const createBrand = catchAsync(async (req: Request, res: Response) => {
  const result = await BrandService.createBrand(req);
  sendResponse(res, {
    httpStatusCode: 201,
    success: true,
    message: "Brand created successfully",
    data: result,
  });
});

const getBrands = catchAsync(async (req: Request, res: Response) => {
  const result = await BrandService.getBrands(req.query.all === "true");
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Brands retrieved successfully",
    data: result,
  });
});

const updateBrand = catchAsync(async (req: Request, res: Response) => {
  const result = await BrandService.updateBrand(req.params.id as string, req);
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Brand updated successfully",
    data: result,
  });
});

const deleteBrand = catchAsync(async (req: Request, res: Response) => {
  const result = await BrandService.deleteBrand(req.params.id as string);
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Brand deleted successfully",
    data: result,
  });
});

export const BrandController = {
  createBrand,
  getBrands,
  updateBrand,
  deleteBrand,
};
