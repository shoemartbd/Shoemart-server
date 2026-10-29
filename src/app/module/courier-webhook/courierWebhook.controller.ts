import { Request, Response } from "express";
import AppError from "../../errorHelpers/AppError";
import { CourierWebhookService } from "./courierWebhook.service";

// Response shape here follows Steadfast's own webhook documentation exactly
// ({status, message}), not our app's usual sendResponse envelope.
const handleSteadfastWebhook = async (req: Request, res: Response) => {
  try {
    await CourierWebhookService.processSteadfastWebhook(
      req.body,
      req.headers.authorization,
    );
    res.status(200).json({
      status: "success",
      message: "Webhook received successfully.",
    });
  } catch (error) {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const message =
      error instanceof AppError ? error.message : "Failed to process webhook";
    res.status(statusCode).json({ status: "error", message });
  }
};

const handleRedxWebhook = async (req: Request, res: Response) => {
  try {
    await CourierWebhookService.processRedxWebhook(req.body, req.query.token as string | undefined);
    res.status(200).json({ success: true, message: "Webhook received" });
  } catch (error) {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const message = error instanceof AppError ? error.message : "Failed to process webhook";
    res.status(statusCode).json({ success: false, message });
  }
};

export const CourierWebhookController = {
  handleSteadfastWebhook,
  handleRedxWebhook,
};
