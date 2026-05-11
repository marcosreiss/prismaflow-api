// src/modules/payments/services/payment-installment.service.ts

import { Request } from "express";
import { ApiResponse } from "@/responses/ApiResponse";
import { PagedResponse } from "@/responses/PagedResponse";
import { PaymentRepository } from "@/modules/payments/repository/payment.repository";
import { PaymentInstallmentRepository } from "@/modules/payments/repository/payment-installment.repository";

export class PaymentInstallmentService {
  private paymentRepo = new PaymentRepository();
  private installmentRepo = new PaymentInstallmentRepository();

  // ─── Helper ───────────────────────────────────────────────────────────────────

  private enrichInstallment(inst: any) {
    const now = new Date();
    const isPaid = inst.paidAt !== null;
    const isPartiallyPaid = inst.paidAmount > 0 && !isPaid;
    const dueDate = inst.dueDate ? new Date(inst.dueDate) : null;
    const isOverdue = dueDate && !isPaid && dueDate < now;
    const daysOverdue =
      isOverdue && dueDate
        ? Math.floor(
            (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
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
  }

  // ─── Listar Parcelas de um Pagamento ─────────────────────────────────────────

  async findByPaymentId(req: Request) {
    const { tenantId } = req.user!;
    const { paymentId } = req.params;

    const payment = await this.paymentRepo.findById(
      Number(paymentId),
      tenantId,
    );
    if (!payment) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    const allInstallments = payment.methods.flatMap((m) =>
      m.installmentItems.map((inst) => ({
        ...inst,
        methodId: m.id,
        method: m.method,
      })),
    );

    const enriched = allInstallments.map((i) => this.enrichInstallment(i));

    const summary = {
      total: enriched.length,
      paid: enriched.filter((i) => i.isPaid).length,
      pending: enriched.filter((i) => !i.isPaid).length,
      overdue: enriched.filter((i) => i.isOverdue).length,
      totalAmount: enriched.reduce((sum, i) => sum + i.amount, 0),
      paidAmount: enriched.reduce((sum, i) => sum + i.paidAmount, 0),
      remainingAmount: enriched.reduce((sum, i) => sum + i.remainingAmount, 0),
    };

    return ApiResponse.success("Parcelas listadas com sucesso.", req, {
      paymentId: payment.id,
      saleId: payment.saleId,
      summary,
      installments: enriched,
    });
  }

  // ─── Buscar Parcela por ID ────────────────────────────────────────────────────

  async findById(req: Request) {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const installment = await this.installmentRepo.findById(Number(id));
    if (!installment) {
      return ApiResponse.error("Parcela não encontrada.", 404, req);
    }

    if (installment.paymentMethodItem.payment.tenantId !== tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar esta parcela.",
        403,
        req,
      );
    }

    return ApiResponse.success(
      "Parcela encontrada com sucesso.",
      req,
      this.enrichInstallment(installment),
    );
  }

  // ─── Atualizar Parcela ────────────────────────────────────────────────────────

  async update(req: Request) {
    const { sub: userId, tenantId } = req.user!;
    const { id } = req.params;
    const { amount, dueDate, sequence } = req.body;

    const installment = await this.installmentRepo.findById(Number(id));
    if (!installment) {
      return ApiResponse.error("Parcela não encontrada.", 404, req);
    }

    if (installment.paymentMethodItem.payment.tenantId !== tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar esta parcela.",
        403,
        req,
      );
    }

    if (installment.paidAt !== null) {
      return ApiResponse.error(
        "Não é possível editar uma parcela já quitada.",
        400,
        req,
      );
    }

    if (amount !== undefined && amount !== installment.amount) {
      const methodItem = installment.paymentMethodItem;
      const allInstallments = await this.installmentRepo.findByMethodItemId(
        methodItem.id,
      );

      const newTotal = allInstallments.reduce(
        (sum, inst) =>
          sum + (inst.id === installment.id ? amount : inst.amount),
        0,
      );

      if (Math.abs(newTotal - methodItem.amount) > 0.01) {
        return ApiResponse.error(
          `A soma das parcelas (R$ ${newTotal.toFixed(2)}) deve ser igual ao valor do método (R$ ${methodItem.amount.toFixed(2)}).`,
          400,
          req,
        );
      }
    }

    const updated = await this.installmentRepo.update(
      Number(id),
      { amount, dueDate, sequence },
      userId,
    );

    return ApiResponse.success("Parcela atualizada com sucesso.", req, updated);
  }

  // ─── Listar Parcelas Vencidas ─────────────────────────────────────────────────

  async findOverdue(req: Request) {
    const { tenantId } = req.user!;
    const { page = 1, limit = 10 } = req.query;

    const { items, total } = await this.installmentRepo.findOverdue(
      tenantId,
      Number(page),
      Number(limit),
    );

    const now = new Date();
    const enrichedItems = items.map((inst) => {
      const dueDate = inst.dueDate ? new Date(inst.dueDate) : null;
      const daysOverdue = dueDate
        ? Math.floor(
            (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 0;

      return {
        ...inst,
        daysOverdue,
        remainingAmount: inst.amount - inst.paidAmount,
        clientName: inst.paymentMethodItem.payment.sale?.client?.name ?? "N/A",
        clientPhone:
          inst.paymentMethodItem.payment.sale?.client?.phone01 ?? null,
      };
    });

    const stats = {
      totalOverdue: total,
      totalAmount: enrichedItems.reduce((sum, i) => sum + i.remainingAmount, 0),
      averageDaysOverdue:
        enrichedItems.length > 0
          ? Math.round(
              enrichedItems.reduce((sum, i) => sum + i.daysOverdue, 0) /
                enrichedItems.length,
            )
          : 0,
    };

    return new PagedResponse(
      "Parcelas vencidas listadas com sucesso.",
      req,
      enrichedItems,
      Number(page),
      Number(limit),
      total,
      stats,
    );
  }
}
