import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { PosService } from "./pos.service";
import { IQueryParams } from "../../interfaces/query.interface";
import { ShopService } from "../shop/shop.service";

const getShopProducts = catchAsync(async (req: Request, res: Response) => {
  const shopId = await ShopService.getDefaultShopId();
  const result = await PosService.getShopProducts(shopId, req.query as IQueryParams);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "POS Products fetched successfully",
    ...result,
  });
});

const getPosCart = catchAsync(async (req: Request, res: Response) => {
  const shopId = await ShopService.getDefaultShopId();
  const data = await PosService.getPosCart(shopId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "POS Cart fetched successfully",
    data,
  });
});

const addToPosCart = catchAsync(async (req: Request, res: Response) => {
  const shopId = await ShopService.getDefaultShopId();
  const data = await PosService.addToPosCart(shopId, req.body);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Item added to POS cart",
    data,
  });
});

const updatePosCartItem = catchAsync(async (req: Request, res: Response) => {
  const shopId = await ShopService.getDefaultShopId();
  const data = await PosService.updatePosCartItem(
    shopId,
    req.params.id as string,
    req.body.quantity
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "POS Cart item updated successfully",
    data,
  });
});

const deletePosCartItem = catchAsync(async (req: Request, res: Response) => {
  const shopId = await ShopService.getDefaultShopId();
  const data = await PosService.deletePosCartItem(shopId, req.params.id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "POS Cart item removed successfully",
    data,
  });
});

const clearPosCart = catchAsync(async (req: Request, res: Response) => {
  const shopId = await ShopService.getDefaultShopId();
  await PosService.clearPosCart(shopId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "POS Cart cleared successfully",
    data: null,
  });
});

const createPosOrder = catchAsync(async (req: Request, res: Response) => {
  const shopId = await ShopService.getDefaultShopId();
  const data = await PosService.createPosOrder(shopId, req.body);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "POS Order created successfully",
    data,
  });
});

const getPosOrders = catchAsync(async (req: Request, res: Response) => {
  const shopId = await ShopService.getDefaultShopId();
  const result = await PosService.getPosOrders(shopId, req.query as IQueryParams);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "POS Orders fetched successfully",
    ...result,
  });
});

export const PosController = {
  getShopProducts,
  getPosCart,
  addToPosCart,
  updatePosCartItem,
  deletePosCartItem,
  clearPosCart,
  createPosOrder,
  getPosOrders,
};
