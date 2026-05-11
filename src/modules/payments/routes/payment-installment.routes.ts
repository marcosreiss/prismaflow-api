// src/modules/payments/routes/payment-installment.routes.ts

import { Router } from "express";
import { authGuard } from "../../../middlewares/auth.middleware";
import { validateDto } from "../../../middlewares/validation.middleware";
import {
  listInstallmentsByPayment,
  getInstallmentById,
  updateInstallment,
  payInstallment,
  listOverdueInstallments,
} from "../controller/payment-installment.controller";
import {
  UpdatePaymentInstallmentDto,
  PayInstallmentDto,
} from "../dtos/payment-installment.dto";

export const paymentInstallmentRoutes = Router();

paymentInstallmentRoutes.get("/overdue", authGuard, listOverdueInstallments);
paymentInstallmentRoutes.get(
  "/by-payment/:paymentId",
  authGuard,
  listInstallmentsByPayment,
);
paymentInstallmentRoutes.get("/:id", authGuard, getInstallmentById);
paymentInstallmentRoutes.put(
  "/:id",
  authGuard,
  validateDto(UpdatePaymentInstallmentDto, "body"),
  updateInstallment,
);
paymentInstallmentRoutes.patch(
  "/:id/pay",
  authGuard,
  validateDto(PayInstallmentDto, "body"),
  payInstallment,
);
