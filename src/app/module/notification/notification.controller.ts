import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { NotificationService } from "./notification.service";

const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const result = await NotificationService.getMyNotifications(
    req.user.userId as string,
    limit,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Notifications fetched successfully",
    data: result,
  });
});

const markAsRead = catchAsync(async (req: Request, res: Response) => {
  await NotificationService.markAsRead(
    req.user.userId as string,
    req.params.id as string,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Notification marked as read",
    data: null,
  });
});

const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  await NotificationService.markAllAsRead(req.user.userId as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "All notifications marked as read",
    data: null,
  });
});

export const NotificationController = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
