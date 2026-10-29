import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ProductService } from "./product.service";
import { IQueryParams } from "../../interfaces/query.interface";

const createProduct = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };

  if (req.files && Array.isArray(req.files)) {
    payload.images = req.files.map((file: Express.Multer.File) => file.path);
  }

  const result = await ProductService.createProduct(payload);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Product created successfully",
    data: result,
  });
});

const generateSku = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.generateSku();

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "SKU generated successfully",
    data: result,
  });
});

const getAllProducts = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await ProductService.getAllProducts(req.query as IQueryParams);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Products fetched successfully",
    data,
    meta,
  });
});

const getProductById = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.getProductById(req.params.id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Product fetched successfully",
    data: result,
  });
});

const getProductBySlug = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.getProductBySlug(req.params.slug as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Product fetched successfully",
    data: result,
  });
});

const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const payload = { ...req.body };

  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    payload.images = req.files.map((file: Express.Multer.File) => file.path);
  }

  const result = await ProductService.updateProduct(id as string, payload);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Product updated successfully",
    data: result,
  });
});

const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await ProductService.deleteProduct(id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

const bulkDeleteProducts = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.bulkDeleteProducts(req.body.productIds);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: `${result.deleted} product(s) deleted`,
    data: result,
  });
});

const getProductVariants = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await ProductService.getProductVariants(id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Product variants fetched successfully",
    data: result,
  });
});

const uploadVariantImage = catchAsync(async (req: Request, res: Response) => {
  const { productId, variantId } = req.params;

  if (!req.file) {
    return sendResponse(res, {
      httpStatusCode: status.BAD_REQUEST,
      success: false,
      message: "No image file uploaded",
      data: null,
    });
  }

  const imageUrl = req.file.path;

  const result = await ProductService.uploadVariantImage(
    productId as string,
    variantId as string,
    imageUrl,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Variant image uploaded successfully",
    data: result,
  });
});

export const ProductController = {
  createProduct,
  generateSku,
  getAllProducts,
  getProductById,
  getProductBySlug,
  updateProduct,
  deleteProduct,
  bulkDeleteProducts,
  getProductVariants,
  uploadVariantImage,
};
