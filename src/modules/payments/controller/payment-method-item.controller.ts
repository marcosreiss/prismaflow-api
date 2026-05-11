// src/modules/payments/controller/payment-method-item.controller.ts

import { Request, Response, NextFunction } from "express";
import { PaymentMethodItemService } from "../services/payment-method-item.service";

const service = new PaymentMethodItemService();

export const deleteMethodItem = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.delete(req);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
