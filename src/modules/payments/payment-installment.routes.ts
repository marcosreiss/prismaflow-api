import { Router } from "express";
import { authGuard } from "../../middlewares/auth.middleware";
import { validateDto } from "../../middlewares/validation.middleware";
import {
  listInstallmentsByPayment,
  getInstallmentById,
  payInstallment,
  updateInstallment,
  listOverdueInstallments,
} from "./payment-installment.controller";
import {
  PayInstallmentDto,
  UpdatePaymentInstallmentDto,
} from "./dtos/payment-installment.dto";

export const paymentInstallmentRoutes = Router();

// ─── Rotas estáticas ──────────────────────────────────────────────────────────

paymentInstallmentRoutes.get("/overdue", authGuard, listOverdueInstallments);

// ─── Rotas por paymentId ──────────────────────────────────────────────────────

paymentInstallmentRoutes.get(
  "/by-payment/:paymentId",
  authGuard,
  listInstallmentsByPayment,
);

// ─── Rotas por installment ID ─────────────────────────────────────────────────

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
