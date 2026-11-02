import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { StoreService } from "./store.service";

const createStore = catchAsync(async (req: Request, res: Response) => {
  const result = await StoreService.createStore(req);
  sendResponse(res, {
    httpStatusCode: 201,
    success: true,
    message: "Store created successfully",
    data: result,
  });
});

const getStores = catchAsync(async (req: Request, res: Response) => {
  const result = await StoreService.getStores(req.query.all === "true");
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Stores retrieved successfully",
    data: result,
  });
});

const updateStore = catchAsync(async (req: Request, res: Response) => {
  const result = await StoreService.updateStore(
    req.params.id as string,
    req,
  );
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Store updated successfully",
    data: result,
  });
});

const deleteStore = catchAsync(async (req: Request, res: Response) => {
  const result = await StoreService.deleteStore(req.params.id as string);
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Store deleted successfully",
    data: result,
  });
});

export const StoreController = {
  createStore,
  getStores,
  updateStore,
  deleteStore,
};
