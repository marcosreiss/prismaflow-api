import { Request, Response, NextFunction } from "express";
import { ExpenseService } from "./expense.service";

const service = new ExpenseService();

export const createExpense = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.create(req, req.body);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const updateExpense = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = Number(req.params.id);
    const result = await service.update(req, id, req.body);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const getExpenseById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = Number(req.params.id);
    const result = await service.getById(req, id);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const listExpenses = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.list(req);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const deleteExpense = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = Number(req.params.id);
    const result = await service.delete(req, id);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};
