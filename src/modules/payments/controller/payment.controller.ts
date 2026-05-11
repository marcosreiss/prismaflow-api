// src/modules/payments/controller/payment.controller.ts

import { Request, Response, NextFunction } from "express";
import { PaymentService } from "../services/payment.service";
import { PaymentUpdateService } from "../services/payment-update.service";

const paymentService = new PaymentService();
const updateService = new PaymentUpdateService();

export const listPayments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await paymentService.findAll(req);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getPaymentById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await paymentService.findById(req);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getPaymentStatusBySale = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await paymentService.findStatusBySaleId(req);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const validatePayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await paymentService.validate(req);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const updatePayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await updateService.update(req);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const updatePaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await updateService.updateStatus(req);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
