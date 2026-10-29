import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { SampleWorkService } from "./sampleWork.service";

const ok = (res: Response, message: string, data: unknown, code = 200) =>
  sendResponse(res, { httpStatusCode: code, success: true, message, data });

const getPublicSampleWorks = catchAsync(async (req: Request, res: Response) => {
  ok(res, "Sample works retrieved successfully", await SampleWorkService.getPublicSampleWorks());
});

const getAllSampleWorks = catchAsync(async (req: Request, res: Response) => {
  ok(res, "Sample works retrieved successfully", await SampleWorkService.getAllSampleWorks());
});

const getUploadSignature = catchAsync(async (req: Request, res: Response) => {
  ok(res, "Upload signature created", SampleWorkService.getUploadSignature());
});

const createSampleWork = catchAsync(async (req: Request, res: Response) => {
  ok(res, "Sample work added", await SampleWorkService.createSampleWork(req.body), 201);
});

const updateSampleWork = catchAsync(async (req: Request, res: Response) => {
  ok(
    res,
    "Sample work updated",
    await SampleWorkService.updateSampleWork(req.params.id as string, req.body),
  );
});

const deleteSampleWork = catchAsync(async (req: Request, res: Response) => {
  ok(res, "Sample work deleted", await SampleWorkService.deleteSampleWork(req.params.id as string));
});

// Public — sends the browser to a fresh signed link for the PDF
// (?download=1 saves the file instead of opening it)
const openFile = catchAsync(async (req: Request, res: Response) => {
  const url = await SampleWorkService.getFileUrl(
    req.params.id as string,
    req.query.download === "1",
  );
  res.setHeader("Cache-Control", "no-store");
  res.redirect(302, url);
});

export const SampleWorkController = {
  openFile,
  getPublicSampleWorks,
  getAllSampleWorks,
  getUploadSignature,
  createSampleWork,
  updateSampleWork,
  deleteSampleWork,
};
