// src/modules/payments/routes/payment.routes.ts

import { Router } from "express";
import { authGuard } from "../../../middlewares/auth.middleware";
import { validateDto } from "../../../middlewares/validation.middleware";
import {
  listPayments,
  getPaymentById,
  getPaymentStatusBySale,
  validatePayment,
  updatePayment,
  updatePaymentStatus,
} from "../controller/payment.controller";
import { UpdatePaymentDto, UpdatePaymentStatusDto } from "../dtos/payment.dto";

export const paymentRoutes = Router();

paymentRoutes.get("/", authGuard, listPayments);
paymentRoutes.get("/by-sale/:saleId", authGuard, getPaymentStatusBySale);
paymentRoutes.get("/:id/validate", authGuard, validatePayment);
paymentRoutes.get("/:id", authGuard, getPaymentById);
paymentRoutes.put(
  "/:id",
  authGuard,
  validateDto(UpdatePaymentDto, "body"),
  updatePayment,
);
paymentRoutes.patch(
  "/:id/status",
  authGuard,
  validateDto(UpdatePaymentStatusDto, "body"),
  updatePaymentStatus,
);
