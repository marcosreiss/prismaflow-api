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
} from "./payment.controller";
import { CreatePaymentDto, UpdatePaymentDto } from "./dtos/payment.dto";

export const paymentRoutes = Router();

// 🔹 Criar pagamento
paymentRoutes.post(
  "/",
  authGuard,
  validateDto(CreatePaymentDto, "body"),
  createPayment
);

// 🔹 Listar pagamentos
paymentRoutes.get("/", authGuard, listPayments);

// 🔹 Buscar pagamento por ID
paymentRoutes.get("/:id", authGuard, getPaymentById);

// 🔹 Buscar status por saleId
paymentRoutes.get("/by-sale/:saleId", authGuard, getPaymentStatusBySale);

// 🔹 Atualizar pagamento
paymentRoutes.put(
  "/:id",
  authGuard,
  validateDto(UpdatePaymentDto, "body"),
  updatePayment
);

// 🔹 Excluir pagamento
paymentRoutes.delete("/:id", authGuard, deletePayment);
