import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import status from "http-status";
import { RAGService } from "./rag.service";

const ragService = new RAGService();

const getStats = catchAsync(async (req: Request, res: Response) => {
  const result = await ragService.getStats();

  sendResponse(res, {
    success: true,
    httpStatusCode: status.OK,
    message: "RAG stats retrieved successfully",
    data: result,
  });
});

const ingestData = catchAsync(async (req: Request, res: Response) => {
  const result = await ragService.ingestData();

  sendResponse(res, {
    success: true,
    httpStatusCode: status.OK,
    message: "Data ingestion completed",
    data: result,
  });
});

const queryRag = catchAsync(async (req: Request, res: Response) => {
  const { query, limit, sourceType } = req.body;

  if (!query) {
    throw new Error("Query is required");
  }

  const result = await ragService.generateAnswer(
    query,
    limit ?? 6,
    sourceType,
    false,
  );

  sendResponse(res, {
    success: true,
    httpStatusCode: status.OK,
    message: "Answer generated successfully",
    data: result,
  });
});

export const RagController = {
  getStats,
  ingestData,
  queryRag,
};
