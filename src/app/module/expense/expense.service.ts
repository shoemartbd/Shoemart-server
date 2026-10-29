import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { sumByPeriod } from "../../utils/periodSummary";
import { ShopService } from "../shop/shop.service";

// ── Expense Categories ──────────────────────────────────────────────

const createCategory = async (payload: { name: string }) => {
  const shopId = await ShopService.getDefaultShopId();

  return prisma.expenseCategory.create({
    data: { name: payload.name, shopId },
  });
};

const getMyCategories = async (queryParams: IQueryParams) => {
  return new QueryBuilder(prisma.expenseCategory, queryParams, {
    searchableFields: ["name"],
    filterableFields: ["isActive"],
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .execute();
};

const updateCategory = async (
  id: string,
  payload: { name?: string; isActive?: boolean },
) => {
  const category = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!category) throw new AppError(status.NOT_FOUND, "Expense category not found");

  return prisma.expenseCategory.update({ where: { id }, data: payload });
};

const deleteCategory = async (id: string) => {
  const category = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!category) throw new AppError(status.NOT_FOUND, "Expense category not found");

  const expenseCount = await prisma.expense.count({ where: { categoryId: id } });
  if (expenseCount > 0) {
    throw new AppError(
      status.BAD_REQUEST,
      "Cannot delete a category that has expenses. Deactivate it instead.",
    );
  }

  await prisma.expenseCategory.delete({ where: { id } });
  return { message: "Expense category deleted successfully" };
};

// ── Expenses ─────────────────────────────────────────────────────────

const createExpense = async (payload: {
  categoryId: string;
  name: string;
  price: number;
  note?: string;
  date: string;
}) => {
  const category = await prisma.expenseCategory.findUnique({
    where: { id: payload.categoryId },
  });
  if (!category) {
    throw new AppError(status.BAD_REQUEST, "Invalid expense category");
  }

  const shopId = await ShopService.getDefaultShopId();

  return prisma.expense.create({
    data: {
      name: payload.name,
      price: payload.price,
      note: payload.note,
      date: new Date(payload.date),
      categoryId: payload.categoryId,
      shopId,
    },
    include: { category: { select: { id: true, name: true } } },
  });
};

const getMyExpenses = async (
  queryParams: IQueryParams & { startDate?: string; endDate?: string },
) => {
  const { startDate, endDate, ...rest } = queryParams;

  let dateFilter: { gte?: Date; lte?: Date } | undefined;
  if (startDate || endDate) {
    dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
  }

  return new QueryBuilder(prisma.expense, rest, {
    searchableFields: ["name", "note"],
    filterableFields: ["categoryId"],
  })
    .search()
    .filter()
    .where({ ...(dateFilter && { date: dateFilter }) })
    .sort()
    .paginate()
    .include({ category: { select: { id: true, name: true } } })
    .execute();
};

const updateExpense = async (
  id: string,
  payload: {
    categoryId?: string;
    name?: string;
    price?: number;
    note?: string;
    date?: string;
  },
) => {
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) throw new AppError(status.NOT_FOUND, "Expense not found");

  if (payload.categoryId) {
    const category = await prisma.expenseCategory.findUnique({
      where: { id: payload.categoryId },
    });
    if (!category) {
      throw new AppError(status.BAD_REQUEST, "Invalid expense category");
    }
  }

  return prisma.expense.update({
    where: { id },
    data: {
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.price !== undefined && { price: payload.price }),
      ...(payload.note !== undefined && { note: payload.note }),
      ...(payload.date !== undefined && { date: new Date(payload.date) }),
      ...(payload.categoryId !== undefined && { categoryId: payload.categoryId }),
    },
    include: { category: { select: { id: true, name: true } } },
  });
};

const deleteExpense = async (id: string) => {
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) throw new AppError(status.NOT_FOUND, "Expense not found");

  await prisma.expense.delete({ where: { id } });
  return { message: "Expense deleted successfully" };
};

const getExpenseReportSummary = async () => {
  const shopId = await ShopService.getDefaultShopId();

  const expenses = await prisma.expense.findMany({
    where: { shopId },
    select: { price: true, date: true },
  });

  return sumByPeriod(expenses.map((expense) => ({ amount: expense.price, date: expense.date })));
};

export const ExpenseService = {
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
