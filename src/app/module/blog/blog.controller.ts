import { Request, Response } from "express";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { BlogService } from "./blog.service";

const createBlog = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };

  if (req.file) {
    payload.coverImage = req.file.path;
  }

  const result = await BlogService.createBlog(payload);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Blog created successfully",
    data: result,
  });
});

const getAllBlogs = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await BlogService.getAllBlogs(
    req.query as IQueryParams,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Blogs fetched successfully",
    data,
    meta,
  });
});

const getAllBlogsAdmin = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await BlogService.getAllBlogsAdmin(
    req.query as IQueryParams,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Blogs fetched successfully",
    data,
    meta,
  });
});

const getBlogById = catchAsync(async (req: Request, res: Response) => {
  const result = await BlogService.getBlogById(req.params.id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Blog fetched successfully",
    data: result,
  });
});

const getBlogBySlug = catchAsync(async (req: Request, res: Response) => {
  const result = await BlogService.getBlogBySlug(req.params.slug as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Blog fetched successfully",
    data: result,
  });
});

const updateBlog = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };

  if (req.file) {
    payload.coverImage = req.file.path;
  }

  const result = await BlogService.updateBlog(
    req.params.id as string,
    payload,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Blog updated successfully",
    data: result,
  });
});

const deleteBlog = catchAsync(async (req: Request, res: Response) => {
  const result = await BlogService.deleteBlog(req.params.id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

export const BlogController = {
  createBlog,
  getAllBlogs,
  getAllBlogsAdmin,
  getBlogById,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
};
