import { Request } from "express";
import { ApiResponse } from "@/responses/ApiResponse";
import { PaymentRepository } from "@/modules/payments/repository/payment.repository";
import { PaymentMethodItemRepository } from "@/modules/payments/repository/payment-method-item.repository";
import { PaymentInstallmentRepository } from "@/modules/payments/repository/payment-installment.repository";
import { PaymentIntegrityService } from "./payment-integrity.service";

export class PaymentMethodItemService {
  private paymentRepo = new PaymentRepository();
  private methodItemRepo = new PaymentMethodItemRepository();
  private installmentRepo = new PaymentInstallmentRepository();
  private integrityService = new PaymentIntegrityService();

  // ─── Criar Método em um Payment Existente ────────────────────────────────────

  async create(req: Request) {
    const user = req.user!;
    const { sub: userId, tenantId, branchId } = user;
    const { paymentId } = req.params;
    const { method, amount, installments, firstDueDate } = req.body;

    const payment = await this.paymentRepo.findById(Number(paymentId));
    if (!payment) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    if (payment.tenantId !== tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar este pagamento.",
        403,
        req,
      );
    }

    if (installments && installments > 0 && !firstDueDate) {
      return ApiResponse.error(
        "Para método parcelado, é necessário informar firstDueDate.",
        400,
        req,
      );
    }

    const methodItem = await this.methodItemRepo.create(
      {
        paymentId: Number(paymentId),
        method,
        amount,
        installments: installments || null,
        firstDueDate: firstDueDate ? new Date(firstDueDate) : null,
        tenantId,
        branchId,
      },
      userId,
    );

    if (installments && installments > 0 && firstDueDate) {
      await this.integrityService.generateInstallments(
        {
          id: methodItem.id,
          amount,
          installments,
          firstDueDate: new Date(firstDueDate),
        },
        { tenantId, branchId, userId },
      );
    }

    const updated = await this.paymentRepo.findById(Number(paymentId));

    return ApiResponse.success(
      "Método de pagamento adicionado com sucesso.",
      req,
      updated,
    );
  }

  // ─── Atualizar Método ────────────────────────────────────────────────────────

  async update(req: Request) {
    const user = req.user!;
    const { sub: userId, tenantId } = user;
    const { id } = req.params;
    const data = req.body;

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

    const hasPaidInstallments = methodItem.installmentItems.some(
      (inst) => inst.paidAt !== null,
    );

    if (hasPaidInstallments) {
      return ApiResponse.error(
        "Não é possível alterar um método que já possui parcelas pagas.",
        400,
        req,
      );
    }

    const updated = await this.methodItemRepo.update(Number(id), data, userId);

    return ApiResponse.success(
      "Método de pagamento atualizado com sucesso.",
      req,
      updated,
    );
  }

  // ─── Remover Método ──────────────────────────────────────────────────────────

  async delete(req: Request) {
    const user = req.user!;
    const { tenantId } = user;
    const { id } = req.params;

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

    const hasPaidInstallments = methodItem.installmentItems.some(
      (inst) => inst.paidAt !== null,
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

    return ApiResponse.success(
      "Método de pagamento removido com sucesso.",
      req,
    );
  }
}
