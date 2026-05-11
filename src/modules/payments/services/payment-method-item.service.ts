// src/modules/payments/services/payment-method-item.service.ts

import { Request } from "express";
import { ApiResponse } from "@/responses/ApiResponse";
import { PaymentRepository } from "@/modules/payments/repository/payment.repository";
import { PaymentMethodItemRepository } from "@/modules/payments/repository/payment-method-item.repository";
import { PaymentInstallmentRepository } from "@/modules/payments/repository/payment-installment.repository";
import { PaymentIntegrityService } from "./payment-integrity.service";
import { PaymentStatus, PaymentMethod } from "@prisma/client";

export class PaymentMethodItemService {
  private paymentRepo = new PaymentRepository();
  private methodItemRepo = new PaymentMethodItemRepository();
  private installmentRepo = new PaymentInstallmentRepository();
  private integrityService = new PaymentIntegrityService();

  async delete(req: Request) {
    const { id } = req.params;
    const { sub: userId, tenantId } = req.user!;

    const methodItem = await this.methodItemRepo.findById(Number(id));
    if (!methodItem) {
      return ApiResponse.error("Método de pagamento não encontrado.", 404, req);
    }

    if (methodItem.tenantId !== tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar este método.",
        403,
        req,
      );
    }

    const payment = await this.paymentRepo.findById(
      methodItem.paymentId,
      tenantId,
    );
    if (!payment) {
      return ApiResponse.error("Pagamento vinculado não encontrado.", 404, req);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      return ApiResponse.error(
        "Só é possível remover métodos de pagamentos com status PENDING.",
        400,
        req,
      );
    }

    const hasPaidInstallments = methodItem.installmentItems.some(
      (i) => i.paidAt !== null,
    );
    if (hasPaidInstallments) {
      return ApiResponse.error(
        "Não é possível remover um método que já possui parcelas pagas.",
        400,
        req,
      );
    }

    await this.installmentRepo.deleteByMethodItemId(Number(id));
    await this.methodItemRepo.delete(Number(id));

    // Recalcular paidAmount e status após remoção
    await this.integrityService.recalculatePaymentStatus(payment.id, userId);

    return ApiResponse.success(
      "Método de pagamento removido com sucesso.",
      req,
    );
  }
}
