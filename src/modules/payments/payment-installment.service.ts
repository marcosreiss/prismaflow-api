// payment-installment.service.ts

import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PaymentRepository } from "./payment.repository";
import { PaymentStatus } from "@prisma/client";
import { PagedResponse } from "../../responses/PagedResponse";

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

  // ======================================================
  // REGISTRAR PAGAMENTO DE PARCELA
  // ======================================================
  async payInstallment(req: Request) {
    const user = req.user!;
    const { id } = req.params;
    const { paidAmount, paidAt } = req.body;
    const userId = user.sub;

    // 1️⃣ Buscar parcela
    const installment = await this.repo.findInstallmentById(Number(id));
    if (!installment) {
      return ApiResponse.error("Parcela não encontrada.", 404, req);
    }

    // 2️⃣ Verificar permissão
    if (installment.tenantId !== user.tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar esta parcela.",
        403,
        req
      );
    }

    // 3️⃣ Validar se parcela já foi paga completamente
    if (installment.paidAmount >= installment.amount) {
      return ApiResponse.error(
        "Esta parcela já foi paga completamente.",
        400,
        req
      );
    }

    // 4️⃣ Validar valor do pagamento
    const remainingAmount = installment.amount - installment.paidAmount;
    if (paidAmount > remainingAmount) {
      return ApiResponse.error(
        `O valor pago (${paidAmount}) não pode ser maior que o valor restante da parcela (${remainingAmount}).`,
        400,
        req
      );
    }

    // 5️⃣ Calcular novo paidAmount
    const newPaidAmount = installment.paidAmount + paidAmount;
    const paymentDate = paidAt ? new Date(paidAt) : new Date();

    // 6️⃣ Atualizar parcela
    const updatedInstallment = await this.repo.updateInstallment(
      Number(id),
      {
        paidAmount: newPaidAmount,
        paidAt: paymentDate,
      },
      userId
    );

    // 7️⃣ Buscar payment associado
    const payment = await this.repo.findById(installment.paymentId);
    if (!payment) {
      return ApiResponse.error("Pagamento associado não encontrado.", 404, req);
    }

    // 8️⃣ Recalcular dados do Payment
    await this.recalculatePaymentStatus(installment.paymentId, userId);

    // 9️⃣ Retornar parcela atualizada com dados do payment
    const final = await this.repo.findInstallmentById(Number(id));

    return ApiResponse.success(
      "Pagamento da parcela registrado com sucesso.",
      req,
      {
        installment: final,
        message:
          newPaidAmount >= installment.amount
            ? "Parcela paga completamente."
            : `Pagamento parcial registrado. Restante: R$ ${(
                installment.amount - newPaidAmount
              ).toFixed(2)}`,
      }
    );
  }

  // ======================================================
  // RECALCULAR STATUS DO PAYMENT
  // ======================================================
  private async recalculatePaymentStatus(paymentId: number, userId: string) {
    // 1️⃣ Buscar todas as parcelas do pagamento
    const installments = await this.repo.findInstallmentsByPayment(paymentId);

    if (installments.length === 0) {
      return; // Não tem parcelas, não faz nada
    }

    // 2️⃣ Calcular totais
    const installmentsPaid = installments.filter(
      (inst) => inst.paidAmount >= inst.amount
    ).length;

    const totalPaidAmount = installments.reduce(
      (sum, inst) => sum + inst.paidAmount,
      0
    );

    const allPaid = installments.every(
      (inst) => inst.paidAmount >= inst.amount
    );

    // 3️⃣ Buscar última data de pagamento
    const paidInstallments = installments.filter((inst) => inst.paidAt);
    const lastPaymentAt =
      paidInstallments.length > 0
        ? paidInstallments.reduce((latest, inst) => {
            const instDate = new Date(inst.paidAt!);
            return instDate > latest ? instDate : latest;
          }, new Date(paidInstallments[0].paidAt!))
        : null;

    // 4️⃣ Determinar novo status
    let newStatus: PaymentStatus = PaymentStatus.PENDING; // ✅ Adicionar tipo explícito
    if (allPaid) {
      newStatus = PaymentStatus.CONFIRMED;
    } else if (installmentsPaid > 0) {
      newStatus = PaymentStatus.PENDING; // Parcialmente pago ainda é PENDING
    }

    // 5️⃣ Atualizar Payment
    await this.repo.update(
      paymentId,
      {
        installmentsPaid,
        paidAmount: totalPaidAmount,
        lastPaymentAt,
        status: newStatus,
      },
      userId
    );
  }

  // ======================================================
  // ATUALIZAR PARCELA
  // ======================================================
  async update(req: Request) {
    const user = req.user!;
    const { id } = req.params;
    const data = req.body;
    const userId = user.sub;

    // 1️⃣ Buscar parcela
    const installment = await this.repo.findInstallmentById(Number(id));
    if (!installment) {
      return ApiResponse.error("Parcela não encontrada.", 404, req);
    }

    // 2️⃣ Verificar permissão
    if (installment.tenantId !== user.tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar esta parcela.",
        403,
        req
      );
    }

    // 3️⃣ Validar se parcela já foi paga
    if (installment.paidAmount > 0) {
      return ApiResponse.error(
        "Não é possível editar parcelas que já receberam pagamento.",
        400,
        req
      );
    }

    // 4️⃣ Buscar payment associado
    const payment = await this.repo.findById(installment.paymentId);
    if (!payment) {
      return ApiResponse.error("Pagamento associado não encontrado.", 404, req);
    }

    // 5️⃣ Se está alterando o valor (amount), validar soma total
    if (data.amount !== undefined && data.amount !== installment.amount) {
      // Buscar todas as parcelas do pagamento
      const allInstallments = await this.repo.findInstallmentsByPayment(
        installment.paymentId
      );

      // Calcular novo total das parcelas (substituindo o valor da parcela atual)
      const newTotalInstallments = allInstallments.reduce((sum, inst) => {
        if (inst.id === installment.id) {
          return sum + data.amount; // Usar novo valor
        }
        return sum + inst.amount; // Manter valor existente
      }, 0);

      // Calcular valor esperado das parcelas
      const expectedTotal =
        payment.total - (payment.discount || 0) - (payment.downPayment || 0);

      // Validar se a soma bate
      if (Math.abs(newTotalInstallments - expectedTotal) > 0.01) {
        // Tolerância de 1 centavo por arredondamento
        return ApiResponse.error(
          `A soma das parcelas (R$ ${newTotalInstallments.toFixed(
            2
          )}) deve ser igual ao valor a parcelar (R$ ${expectedTotal.toFixed(
            2
          )}).`,
          400,
          req
        );
      }
    }

    // 6️⃣ Validar data de vencimento (se informada)
    if (data.dueDate) {
      const dueDate = new Date(data.dueDate);
      if (isNaN(dueDate.getTime())) {
        return ApiResponse.error("Data de vencimento inválida.", 400, req);
      }
    }

    // 7️⃣ Atualizar parcela
    const updated = await this.repo.updateInstallment(
      Number(id),
      {
        amount: data.amount,
        dueDate: data.dueDate,
        sequence: data.sequence,
      },
      userId
    );

    return ApiResponse.success("Parcela atualizada com sucesso.", req, updated);
  }

  // ======================================================
  // LISTAR PARCELAS VENCIDAS
  // ======================================================
  async findOverdue(req: Request) {
    const user = req.user!;
    const { tenantId } = user;
    const { page = 1, limit = 10 } = req.query;

    const { items, total } = await this.repo.findOverdueInstallments(
      tenantId,
      Number(page),
      Number(limit)
    );

    // Calcular dias de atraso
    const now = new Date();
    const enrichedItems = items.map((inst) => {
      const dueDate = inst.dueDate ? new Date(inst.dueDate) : null;
      const daysOverdue = dueDate
        ? Math.floor(
            (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
          )
        : 0;

      return {
        ...inst,
        daysOverdue,
        remainingAmount: inst.amount - inst.paidAmount,
        clientName: inst.payment.sale?.client?.name || "N/A",
        clientPhone: inst.payment.sale?.client?.phone01 || null,
      };
    });

    // Calcular estatísticas
    const stats = {
      totalOverdue: total,
      totalAmount: enrichedItems.reduce((sum, i) => sum + i.remainingAmount, 0),
      averageDaysOverdue:
        enrichedItems.length > 0
          ? Math.round(
              enrichedItems.reduce((sum, i) => sum + i.daysOverdue, 0) /
                enrichedItems.length
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
      stats
    );
  }
}
