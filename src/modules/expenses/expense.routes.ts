import { Router } from "express";
import {
  createExpense,
  updateExpense,
  getExpenseById,
  listExpenses,
  deleteExpense,
} from "./expense.controller";
import { CreateExpenseDto } from "./dtos/create-expense.dto";
import { UpdateExpenseDto } from "./dtos/update-expense.dto";
import { authGuard } from "@/middlewares/auth.middleware";
import { requireRoles } from "@/middlewares/authorize.middleware";
import { validateDto } from "@/middlewares/validation.middleware";

export const expenseRoutes = Router();

expenseRoutes.post(
  "/",
  authGuard,
  requireRoles("ADMIN", "MANAGER"),
  validateDto(CreateExpenseDto, "body"),
  createExpense,
);

expenseRoutes.put(
  "/:id",
  authGuard,
  requireRoles("ADMIN", "MANAGER"),
  validateDto(UpdateExpenseDto, "body"),
  updateExpense,
);

expenseRoutes.get(
  "/",
  authGuard,
  requireRoles("ADMIN", "MANAGER"),
  listExpenses,
);

expenseRoutes.get(
  "/:id",
  authGuard,
  requireRoles("ADMIN", "MANAGER"),
  getExpenseById,
);

expenseRoutes.delete(
  "/:id",
  authGuard,
  requireRoles("ADMIN", "MANAGER"),
  deleteExpense,
);
