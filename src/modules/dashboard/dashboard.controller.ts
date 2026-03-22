import { Request, Response, NextFunction } from "express";
import { DashboardService } from "./dashboard.service";

const service = new DashboardService();

export const getBalance = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.getBalance(req);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const getSalesSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.getSalesSummary(req);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const getPaymentsByStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.getPaymentsByStatus(req);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const getTopProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.getTopProducts(req);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const getTopClients = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.getTopClients(req);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const getOverdueInstallments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.getOverdueInstallments(req);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};
