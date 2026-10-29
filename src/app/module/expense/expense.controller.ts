import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IQueryParams } from "../../interfaces/query.interface";
import { ExpenseService } from "./expense.service";

// ── Expense Categories ──────────────────────────────────────────────

const createCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await ExpenseService.createCategory(req.body);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Expense category created successfully",
    data: result,
  });
});

const getMyCategories = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await ExpenseService.getMyCategories(
    req.query as IQueryParams,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Expense categories fetched successfully",
    data,
    meta,
  });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await ExpenseService.updateCategory(
    req.params.id as string,
    req.body,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Expense category updated successfully",
    data: result,
  });
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await ExpenseService.deleteCategory(req.params.id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

// ── Expenses ─────────────────────────────────────────────────────────

const createExpense = catchAsync(async (req: Request, res: Response) => {
  const result = await ExpenseService.createExpense(req.body);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Expense added successfully",
    data: result,
  });
});

const getMyExpenses = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await ExpenseService.getMyExpenses(
    req.query as IQueryParams,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Expenses fetched successfully",
    data,
    meta,
  });
});

const updateExpense = catchAsync(async (req: Request, res: Response) => {
  const result = await ExpenseService.updateExpense(
    req.params.id as string,
    req.body,
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Expense updated successfully",
    data: result,
  });
});

const deleteExpense = catchAsync(async (req: Request, res: Response) => {
  const result = await ExpenseService.deleteExpense(req.params.id as string);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

const getExpenseReportSummary = catchAsync(async (req: Request, res: Response) => {
  const result = await ExpenseService.getExpenseReportSummary();

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Expense report fetched successfully",
    data: result,
  });
});

export const ExpenseController = {
  createCategory,
  getMyCategories,
  updateCategory,
  deleteCategory,
  createExpense,
  getMyExpenses,
  updateExpense,
  deleteExpense,
  getExpenseReportSummary,
};
