import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { OrderService } from "./order.service";
import { RedxCourierService } from "../courier/redxCourier.service";
import { IQueryParams } from "../../interfaces/query.interface";

const createOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.createOrder(req.user.userId as string, req.body);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Order placed successfully",
    data: result,
  });
});

// Online checkout without an account (only when enabled in Site Settings)
const createGuestOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.createGuestOrder(req.body);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Order placed successfully",
    data: result,
  });
});

const getAllOrders = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await OrderService.getAllOrders(req.query as IQueryParams);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Orders fetched successfully",
    data,
    meta,
  });
});

const exportOrders = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.exportOrders(req.query as IQueryParams);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Orders exported successfully",
    data: result,
  });
});

const getMyOrders = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await OrderService.getAllOrders({
    ...req.query,
    userId: req.user.userId,
  } as IQueryParams);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "My orders fetched successfully",
    data,
    meta,
  });
});

const getOrderById = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.getOrderById(
    req.params.id as string,
    req.user.userId as string,
    req.user.role as string,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Order details fetched successfully",
    data: result,
  });
});

const getPublicOrderById = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.getPublicOrderById(req.params.id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Order details fetched successfully",
    data: result,
  });
});

const trackOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.trackOrder(
    req.body.orderNumber as string,
    req.body.phone as string,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Order details fetched successfully",
    data: result,
  });
});

const checkOrderFraud = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.checkOrderFraud(
    req.params.id as string,
    req.user.userId as string,
    req.user.role as string,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Fraud check fetched successfully",
    data: result,
  });
});

const updateOrderStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.updateOrderStatus(
    req.params.id as string,
    req.body.status,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Order status updated successfully",
    data: result,
  });
});

const updateOrderDiscount = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.updateOrderDiscount(
    req.params.id as string,
    req.body.discountAmount,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Order discount updated successfully",
    data: result,
  });
});

const updatePaymentStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.updatePaymentStatus(
    req.params.id as string,
    req.body.paymentStatus,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Payment status updated successfully",
    data: result,
  });
});

const assignCourier = catchAsync(async (req: Request, res: Response) => {
  const { provider, redxAreaId, redxAreaName } = req.body;
  const result = await OrderService.assignCourier(req.params.id as string, provider, {
    ...(redxAreaId && redxAreaName && { redxArea: { id: redxAreaId, name: redxAreaName } }),
  });

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Order assigned to courier successfully",
    data: result,
  });
});

const deleteOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.deleteOrder(req.params.id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Order deleted successfully",
    data: result,
  });
});

const bulkOrderAction = catchAsync(async (req: Request, res: Response) => {
  const { orderIds, ...payload } = req.body;
  const result = await OrderService.bulkOrderAction(orderIds, payload);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: `${result.succeeded} order(s) updated${result.failed.length ? `, ${result.failed.length} failed` : ""}`,
    data: result,
  });
});

const updateOrderItemStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.updateOrderItemStatus(
    req.params.id as string,
    req.body.status,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Order item status updated successfully",
    data: result,
  });
});

const updateOrderItem = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.updateOrderItem(
    req.params.id as string,
    req.body,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Order item updated successfully",
    data: result,
  });
});

// RedX delivery areas for a district (for the "Assign to RedX" picker)
const getRedxAreas = catchAsync(async (req: Request, res: Response) => {
  const result = await RedxCourierService.getAreas(req.query.district as string | undefined);
  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "RedX areas fetched successfully",
    data: result,
  });
});

export const OrderController = {
  getRedxAreas,
  exportOrders,
  createOrder,
  createGuestOrder,
  getAllOrders,
  getMyOrders,
  getOrderById,
  getPublicOrderById,
  trackOrder,
  updateOrderStatus,
  updateOrderDiscount,
  updatePaymentStatus,
  assignCourier,
  deleteOrder,
  bulkOrderAction,
  updateOrderItemStatus,
  updateOrderItem,
  checkOrderFraud,
};
