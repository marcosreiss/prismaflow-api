import { Router } from "express";
import { authGuard } from "../../middlewares/auth.middleware";
import { validateDto } from "../../middlewares/validation.middleware";
import {
  createPayment,
  updatePayment,
  listPayments,
  getPaymentById,
  getPaymentStatusBySale,
  deletePayment,
  updatePaymentStatus,
  validatePayment,
  createPaymentMethodItem,
  updatePaymentMethodItem,
  deletePaymentMethodItem,
  listInstallmentsByPayment,
  getInstallmentById,
  updateInstallment,
  listOverdueInstallments,
  payInstallment,
} from "./payment.controller";
import {
  CreatePaymentDto,
  UpdatePaymentDto,
  UpdatePaymentStatusDto,
  PaymentMethodItemDto,
} from "./dtos/payment.dto";
import {
  UpdatePaymentInstallmentDto,
  PayInstallmentDto,
} from "./dtos/payment-installment.dto";

export const paymentRoutes = Router();

// ─── Rotas Estáticas (sem parâmetros) ────────────────────────────────────────

paymentRoutes.post(
  "/",
  authGuard,
  validateDto(CreatePaymentDto, "body"),
  createPayment,
);

paymentRoutes.get("/", authGuard, listPayments);

// Parcelas vencidas — estático, antes de /:id
paymentRoutes.get("/installments/overdue", authGuard, listOverdueInstallments);

// ─── Rotas por Sale ───────────────────────────────────────────────────────────

// Estático com prefixo — antes de /:id para não colidir
paymentRoutes.get("/by-sale/:saleId", authGuard, getPaymentStatusBySale);

// ─── Rotas por Payment ID ─────────────────────────────────────────────────────

// Subrotas específicas de /:id antes da rota genérica /:id
paymentRoutes.get("/:id/validate", authGuard, validatePayment);

paymentRoutes.patch(
  "/:id/status",
  authGuard,
  validateDto(UpdatePaymentStatusDto, "body"),
  updatePaymentStatus,
);

// Parcelas de um pagamento
paymentRoutes.get("/:id/installments", authGuard, listInstallmentsByPayment);

// Métodos de um pagamento
paymentRoutes.post(
  "/:paymentId/methods",
  authGuard,
  validateDto(PaymentMethodItemDto, "body"),
  createPaymentMethodItem,
);

// Rota genérica /:id — sempre por último no grupo
paymentRoutes.get("/:id", authGuard, getPaymentById);

paymentRoutes.put(
  "/:id",
  authGuard,
  validateDto(UpdatePaymentDto, "body"),
  updatePayment,
);

paymentRoutes.delete("/:id", authGuard, deletePayment);

// ─── Rotas de PaymentMethodItem ───────────────────────────────────────────────

paymentRoutes.put(
  "/methods/:id",
  authGuard,
  validateDto(PaymentMethodItemDto, "body"),
  updatePaymentMethodItem,
);

paymentRoutes.delete("/methods/:id", authGuard, deletePaymentMethodItem);

// ─── Rotas de PaymentInstallment ──────────────────────────────────────────────

paymentRoutes.get("/installments/:id", authGuard, getInstallmentById);

paymentRoutes.put(
  "/installments/:id",
  authGuard,
  validateDto(UpdatePaymentInstallmentDto, "body"),
  updateInstallment,
);

paymentRoutes.patch(
  "/installments/:id/pay",
  authGuard,
  validateDto(PayInstallmentDto, "body"),
  payInstallment,
);