import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CartService } from "./cart.service";

const getCart = catchAsync(async (req: Request, res: Response) => {
  const result = await CartService.getCart(req.user.userId as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Cart fetched successfully",
    data: result,
  });
});

const addToCart = catchAsync(async (req: Request, res: Response) => {
  const result = await CartService.addToCart(req.user.userId as string, req.body);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Item added to cart",
    data: result,
  });
});

const updateCartItemQuantity = catchAsync(async (req: Request, res: Response) => {
  const result = await CartService.updateCartItemQuantity(
    req.user.userId as string,
    req.body,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Cart updated",
    data: result,
  });
});

const removeFromCart = catchAsync(async (req: Request, res: Response) => {
  const result = await CartService.removeFromCart(
    req.user.userId as string,
    req.params.productId as string,
    req.query.productVariantId as string | undefined,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

const clearCart = catchAsync(async (req: Request, res: Response) => {
  const result = await CartService.clearCart(req.user.userId as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

export const CartController = {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
};
