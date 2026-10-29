import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ExpenseController } from "./expense.controller";
import {
  createExpenseCategoryZodSchema,
  createExpenseZodSchema,
  updateExpenseCategoryZodSchema,
  updateExpenseZodSchema,
} from "./expense.validation";

const router = Router();

router.use(checkAuth(Role.ADMIN, Role.SUPER_ADMIN));

// Expense Categories
router.post(
  "/categories",
  validateRequest(createExpenseCategoryZodSchema),
  ExpenseController.createCategory,
);
router.get("/categories", ExpenseController.getMyCategories);
router.patch(
  "/categories/:id",
  validateRequest(updateExpenseCategoryZodSchema),
  ExpenseController.updateCategory,
);
router.delete("/categories/:id", ExpenseController.deleteCategory);

// Expense Report
router.get("/report/summary", ExpenseController.getExpenseReportSummary);

// Expenses
router.post("/", validateRequest(createExpenseZodSchema), ExpenseController.createExpense);
router.get("/", ExpenseController.getMyExpenses);
router.patch("/:id", validateRequest(updateExpenseZodSchema), ExpenseController.updateExpense);
router.delete("/:id", ExpenseController.deleteExpense);

export const ExpenseRoutes = router;
