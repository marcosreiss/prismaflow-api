// payment-installment.service.ts

import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PaymentRepository } from "./payment.repository";

export class PaymentInstallmentService {
  private repo = new PaymentRepository();

  // ======================================================
  // LISTAR PARCELAS DE UM PAGAMENTO
  // ======================================================
  async findByPaymentId(req: Request) {
    const user = req.user!;
    const { paymentId } = req.params;

    // 1️⃣ Verificar se o pagamento existe
    const payment = await this.repo.findById(Number(paymentId));
    if (!payment) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    // 2️⃣ Verificar se o pagamento pertence ao tenant do usuário
    if (payment.tenantId !== user.tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar este pagamento.",
        403,
        req
      );
    }

    // 3️⃣ Buscar parcelas
    const installments = await this.repo.findInstallmentsByPayment(
      Number(paymentId)
    );

    // 4️⃣ Calcular informações adicionais
    const now = new Date();
    const enrichedInstallments = installments.map((inst) => {
      const isPaid = inst.paidAmount >= inst.amount;
      const isPartiallyPaid =
        inst.paidAmount > 0 && inst.paidAmount < inst.amount;
      const dueDate = inst.dueDate ? new Date(inst.dueDate) : null;
      const isOverdue = dueDate && !isPaid && dueDate < now;
      const daysOverdue =
        isOverdue && dueDate
          ? Math.floor(
              (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
            )
          : 0;

      return {
        ...inst,
        isPaid,
        isPartiallyPaid,
        isOverdue,
        daysOverdue,
        remainingAmount: inst.amount - inst.paidAmount,
      };
    });

    // 5️⃣ Calcular resumo
    const summary = {
      total: installments.length,
      paid: enrichedInstallments.filter((i) => i.isPaid).length,
      pending: enrichedInstallments.filter((i) => !i.isPaid).length,
      overdue: enrichedInstallments.filter((i) => i.isOverdue).length,
      totalAmount: installments.reduce((sum, i) => sum + i.amount, 0),
      paidAmount: installments.reduce((sum, i) => sum + i.paidAmount, 0),
      remainingAmount: installments.reduce(
        (sum, i) => sum + (i.amount - i.paidAmount),
        0
      ),
    };

    return ApiResponse.success("Parcelas listadas com sucesso.", req, {
      paymentId: payment.id,
      saleId: payment.saleId,
      summary,
      installments: enrichedInstallments,
    });
  }

  // ======================================================
  // BUSCAR PARCELA POR ID
  // ======================================================
  async findById(req: Request) {
    const user = req.user!;
    const { id } = req.params;

    // Buscar parcela
    const installment = await this.repo.findInstallmentById(Number(id));
    if (!installment) {
      return ApiResponse.error("Parcela não encontrada.", 404, req);
    }

    // Verificar permissão
    if (installment.tenantId !== user.tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar esta parcela.",
        403,
        req
      );
    }

    // Enriquecer dados
    const now = new Date();
    const isPaid = installment.paidAmount >= installment.amount;
    const isPartiallyPaid =
      installment.paidAmount > 0 && installment.paidAmount < installment.amount;
    const dueDate = installment.dueDate ? new Date(installment.dueDate) : null;
    const isOverdue = dueDate && !isPaid && dueDate < now;
    const daysOverdue =
      isOverdue && dueDate
        ? Math.floor(
            (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
          )
        : 0;

    const enriched = {
      ...installment,
      isPaid,
      isPartiallyPaid,
      isOverdue,
      daysOverdue,
      remainingAmount: installment.amount - installment.paidAmount,
    };

    return ApiResponse.success(
      "Parcela encontrada com sucesso.",
      req,
      enriched
    );
  }
}
