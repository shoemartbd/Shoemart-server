import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { AttributeService } from "./attribute.service";

const createAttribute = catchAsync(async (req: Request, res: Response) => {
  const result = await AttributeService.createAttribute(req.body);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Attribute created successfully",
    data: result,
  });
});

const getAllAttributes = catchAsync(async (req: Request, res: Response) => {
  const result = await AttributeService.getAllAttributes();

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Attributes fetched successfully",
    data: result,
  });
});

const getAttributeById = catchAsync(async (req: Request, res: Response) => {
  const result = await AttributeService.getAttributeById(req.params.id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Attribute fetched successfully",
    data: result,
  });
});

const updateAttribute = catchAsync(async (req: Request, res: Response) => {
  const result = await AttributeService.updateAttribute(
    req.params.id as string,
    req.body
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Attribute updated successfully",
    data: result,
  });
});

const deleteAttribute = catchAsync(async (req: Request, res: Response) => {
  const result = await AttributeService.deleteAttribute(req.params.id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

const addAttributeValue = catchAsync(async (req: Request, res: Response) => {
  const result = await AttributeService.addAttributeValue(
    req.params.id as string,
    req.body
  );

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Attribute value added successfully",
    data: result,
  });
});

const deleteAttributeValue = catchAsync(async (req: Request, res: Response) => {
  const result = await AttributeService.deleteAttributeValue(
    req.params.valueId as string
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

const updateAttributeValue = catchAsync(async (req: Request, res: Response) => {
  const result = await AttributeService.updateAttributeValue(
    req.params.valueId as string,
    req.body
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Attribute value updated successfully",
    data: result,
  });
});

export const AttributeController = {
  createAttribute,
  getAllAttributes,
  getAttributeById,
  updateAttribute,
  deleteAttribute,
  addAttributeValue,
  deleteAttributeValue,
  updateAttributeValue,
};
