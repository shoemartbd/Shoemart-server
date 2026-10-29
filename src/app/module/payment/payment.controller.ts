import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { envVars } from "../../config/env";
import { PaymentService } from "./payment.service";

const initiateSslcommerzPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.initiateSslcommerzPayment(req.body.orderId, {
    userId: req.user.userId as string,
  });

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Payment session created successfully",
    data: result,
  });
});

// Orders placed without an account
const initiateSslcommerzGuestPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.initiateSslcommerzPayment(req.body.orderId, {
    guest: true,
  });

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Payment session created successfully",
    data: result,
  });
});

const getCallbackField = (req: Request, field: string) =>
  (req.body?.[field] || req.query?.[field]) as string | undefined;

const handleSuccess = async (req: Request, res: Response) => {
  const tranId = getCallbackField(req, "tran_id");
  const valId = getCallbackField(req, "val_id");

  if (!tranId || !valId) {
    return res.redirect(303, `${envVars.FRONTEND_URL}/payment-failed`);
  }

  try {
    const order = await PaymentService.confirmSslcommerzPayment(tranId, valId);
    return res.redirect(303, `${envVars.FRONTEND_URL}/order-confirmation/${order.id}`);
  } catch {
    return res.redirect(
      303,
      `${envVars.FRONTEND_URL}/payment-failed?tran_id=${encodeURIComponent(tranId)}`,
    );
  }
};

const handleFail = async (req: Request, res: Response) => {
  const tranId = getCallbackField(req, "tran_id");
  if (tranId) await PaymentService.markSslcommerzPaymentFailed(tranId);
  return res.redirect(
    303,
    `${envVars.FRONTEND_URL}/payment-failed${tranId ? `?tran_id=${encodeURIComponent(tranId)}` : ""}`,
  );
};

const handleCancel = async (req: Request, res: Response) => {
  const tranId = getCallbackField(req, "tran_id");
  if (tranId) await PaymentService.markSslcommerzPaymentFailed(tranId);
  return res.redirect(
    303,
    `${envVars.FRONTEND_URL}/payment-failed${tranId ? `?tran_id=${encodeURIComponent(tranId)}&reason=cancelled` : "?reason=cancelled"}`,
  );
};

const handleIpn = async (req: Request, res: Response) => {
  const tranId = getCallbackField(req, "tran_id");
  const valId = getCallbackField(req, "val_id");

  try {
    if (tranId && valId) {
      await PaymentService.confirmSslcommerzPayment(tranId, valId);
    }
    res.status(200).json({ status: "success", message: "IPN received" });
  } catch {
    res.status(200).json({ status: "success", message: "IPN received" });
  }
};

// ── bKash ────────────────────────────────────────────────────────────────

const initiateBkashPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.initiateBkashPayment(req.body.orderId, {
    userId: req.user.userId as string,
  });
  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "bKash payment created successfully",
    data: result,
  });
});

// Orders placed without an account (online checkout or landing page)
const initiateBkashGuestPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.initiateBkashPayment(req.body.orderId, {
    guest: true,
  });
  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "bKash payment created successfully",
    data: result,
  });
});

const handleBkashCallback = async (req: Request, res: Response) => {
  const result = await PaymentService.handleBkashCallback(
    getCallbackField(req, "paymentID"),
    getCallbackField(req, "status"),
  ).catch(() => ({ ok: false as const, reason: "failed" as const }));

  if (result.ok) {
    return res.redirect(303, `${envVars.FRONTEND_URL}/order-confirmation/${result.orderId}`);
  }

  // Lets the failed page offer "Try again with bKash" for the same order
  const params = new URLSearchParams({ method: "bkash" });
  if (result.reason === "cancelled") params.set("reason", "cancelled");
  if ("orderId" in result && result.orderId) {
    params.set("order", result.orderId);
    if (result.isGuest) params.set("guest", "1");
  }
  return res.redirect(303, `${envVars.FRONTEND_URL}/payment-failed?${params.toString()}`);
};

export const PaymentController = {
  initiateSslcommerzPayment,
  initiateSslcommerzGuestPayment,
  handleSuccess,
  handleFail,
  handleCancel,
  handleIpn,
  initiateBkashPayment,
  initiateBkashGuestPayment,
  handleBkashCallback,
};
