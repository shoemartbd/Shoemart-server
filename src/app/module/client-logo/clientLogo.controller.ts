import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ClientLogoService } from "./clientLogo.service";

const createClientLogo = catchAsync(async (req: Request, res: Response) => {
  const result = await ClientLogoService.createClientLogo(req);
  sendResponse(res, {
    httpStatusCode: 201,
    success: true,
    message: "Client added successfully",
    data: result,
  });
});

const getClientLogos = catchAsync(async (req: Request, res: Response) => {
  const result = await ClientLogoService.getClientLogos(req.query.all === "true");
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Clients retrieved successfully",
    data: result,
  });
});

const updateClientLogo = catchAsync(async (req: Request, res: Response) => {
  const result = await ClientLogoService.updateClientLogo(
    req.params.id as string,
    req,
  );
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Client updated successfully",
    data: result,
  });
});

const deleteClientLogo = catchAsync(async (req: Request, res: Response) => {
  const result = await ClientLogoService.deleteClientLogo(req.params.id as string);
  sendResponse(res, {
    httpStatusCode: 200,
    success: true,
    message: "Client deleted successfully",
    data: result,
  });
});

export const ClientLogoController = {
  createClientLogo,
  getClientLogos,
  updateClientLogo,
  deleteClientLogo,
};
