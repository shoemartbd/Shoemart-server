import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { PopupService } from "./popup.service";

const createPopup = catchAsync(async (req: Request, res: Response) => {
  const result = await PopupService.createPopup(req);
  sendResponse(res, {
    httpStatusCode: 201,
    success: true,
    message: "Popup created successfully",
    data: result,
  });
});

const getPopups = catchAsync(async (req: Request, res: Response) => {
  const result = await PopupService.getPopups();
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Popups retrieved successfully",
    data: result,
  });
});

const getActivePopup = catchAsync(async (req: Request, res: Response) => {
  const result = await PopupService.getActivePopup();
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Active popup retrieved successfully",
    data: result,
  });
});

const updatePopup = catchAsync(async (req: Request, res: Response) => {
  const result = await PopupService.updatePopup(req.params.id as string, req);
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Popup updated successfully",
    data: result,
  });
});

const deletePopup = catchAsync(async (req: Request, res: Response) => {
  const result = await PopupService.deletePopup(req.params.id as string);
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Popup deleted successfully",
    data: result,
  });
});

export const PopupController = {
  createPopup,
  getPopups,
  getActivePopup,
  updatePopup,
  deletePopup,
};
