import { Request, Response } from "express";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CategoryService } from "./category.service";

const createCategory = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };

  if (req.files && typeof req.files === "object") {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files.image && files.image[0]) {
      payload.image = files.image[0].path;
    }
    if (files.icon && files.icon[0]) {
      payload.icon = files.icon[0].path;
    }
  }

  const result = await CategoryService.createCategory(payload);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Category created successfully",
    data: result,
  });
});

const getAllCategories = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await CategoryService.getAllCategories(
    req.query as IQueryParams,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Categories fetched successfully",
    data,
    meta,
  });
});

const getAllSubcategories = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, meta } = await CategoryService.getAllSubcategories(
    id as string,
    req.query as IQueryParams,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Subcategories fetched successfully",
    data,
    meta,
  });
});

const getCategoryById = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoryService.getCategoryById(req.params.id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Category fetched successfully",
    data: result,
  });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };

  if (req.files && typeof req.files === "object") {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files.image && files.image[0]) {
      payload.image = files.image[0].path;
    }
    if (files.icon && files.icon[0]) {
      payload.icon = files.icon[0].path;
    }
  }

  const result = await CategoryService.updateCategory(
    req.params.id as string,
    payload,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Category updated successfully",
    data: result,
  });
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoryService.deleteCategory(req.params.id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

export const CategoryController = {
  createCategory,
  getAllCategories,
  getAllSubcategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
