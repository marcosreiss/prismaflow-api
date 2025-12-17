// payment-installment.routes.ts
import { Router } from "express";
import { authGuard } from "../../middlewares/auth.middleware";
import {
  listInstallmentsByPayment,
  getInstallmentById,
} from "./payment-installment.controller";

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
