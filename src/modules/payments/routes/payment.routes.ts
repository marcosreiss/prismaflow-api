import { Router } from "express";
import { authGuard } from "../../../middlewares/auth.middleware";
import { validateDto } from "../../../middlewares/validation.middleware";
import {
  createPayment,
  updatePayment,
  listPayments,
  getPaymentById,
  getPaymentStatusBySale,
  deletePayment,
  updatePaymentStatus,
  validatePayment,
} from "../controller/payment.controller";
import {
  CreatePaymentDto,
  UpdatePaymentDto,
  UpdatePaymentStatusDto,
} from "../dtos/payment.dto";

export const paymentRoutes = Router();

// ─── Rotas estáticas ──────────────────────────────────────────────────────────

paymentRoutes.post(
  "/",
  authGuard,
  validateDto(CreatePaymentDto, "body"),
  createPayment,
);

paymentRoutes.get("/", authGuard, listPayments);

paymentRoutes.get("/by-sale/:saleId", authGuard, getPaymentStatusBySale);

// ─── Subrotas de /:id — específicas antes da genérica ────────────────────────

paymentRoutes.get("/:id/validate", authGuard, validatePayment);

paymentRoutes.patch(
  "/:id/status",
  authGuard,
  validateDto(UpdatePaymentStatusDto, "body"),
  updatePaymentStatus,
);

// ─── Rotas genéricas de /:id ──────────────────────────────────────────────────

paymentRoutes.get("/:id", authGuard, getPaymentById);

paymentRoutes.put(
  "/:id",
  authGuard,
  validateDto(UpdatePaymentDto, "body"),
  updatePayment,
);

paymentRoutes.delete("/:id", authGuard, deletePayment);
