// payment-installment.routes.ts
import { Router } from "express";
import { authGuard } from "../../middlewares/auth.middleware";
import {
  listInstallmentsByPayment,
  getInstallmentById,
  payInstallment,
} from "./payment-installment.controller";
import { validateDto } from "../../middlewares/validation.middleware";
import { PayInstallmentDto } from "./dtos/payment-installment.dto";

export const paymentInstallmentRoutes = Router();

// Rotas sem prefixo (será adicionado no routes/index.ts)
paymentInstallmentRoutes.get(
  "/:paymentId/installments", // ✅ Ajustado
  authGuard,
  listInstallmentsByPayment
);

paymentInstallmentRoutes.get(
  "/installments/:id", // ✅ Mantém como está
  authGuard,
  getInstallmentById
);

paymentInstallmentRoutes.patch(
  "/installments/:id/pay",
  authGuard,
  validateDto(PayInstallmentDto, "body"),
  payInstallment
);
