// src/modules/payments/controller/payment-installment.controller.ts

import { Request, Response, NextFunction } from "express";
import { PaymentInstallmentService } from "../services/payment-installment.service";
import { PaymentInstallmentPayService } from "../services/payment-installment-pay.service";

const service = new PaymentInstallmentService();
const payService = new PaymentInstallmentPayService();

export const listInstallmentsByPayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.findByPaymentId(req);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getInstallmentById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.findById(req);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const updateInstallment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.update(req);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const payInstallment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await payService.pay(req);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const listOverdueInstallments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.findOverdue(req);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
