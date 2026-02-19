import { Request } from "express";
import { ApiResponse } from "../../../responses/ApiResponse";
import { PagedResponse } from "../../../responses/PagedResponse";
import { PaymentRepository } from "../payment.repository";

export class PaymentInstallmentService {
  private repo = new PaymentRepository();

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  // Enriquece uma parcela com métricas calculadas
  private enrichInstallment(inst: any) {
    const now = new Date();
    const isPaid = inst.paidAt !== null;
    const isPartiallyPaid = inst.paidAmount > 0 && !isPaid;
    const dueDate = inst.dueDate ? new Date(inst.dueDate) : null;
    const isOverdue = dueDate && !isPaid && dueDate < now;
    const daysOverdue =
      isOverdue && dueDate
        ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
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
    const user = req.user!;
    const { paymentId } = req.params;

    const payment = await this.repo.findById(Number(paymentId));
    if (!payment) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    if (payment.tenantId !== user.tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar este pagamento.",
        403,
        req
      );
    }

    // Achatar parcelas de todos os métodos
    const allInstallments = payment.methods.flatMap((m) =>
      m.installmentItems.map((inst) => ({
        ...inst,
        methodId: m.id,
        method: m.method,
      }))
    );

    const enrichedInstallments = allInstallments.map(this.enrichInstallment);

    const summary = {
      total: enrichedInstallments.length,
      paid: enrichedInstallments.filter((i) => i.isPaid).length,
      pending: enrichedInstallments.filter((i) => !i.isPaid).length,
      overdue: enrichedInstallments.filter((i) => i.isOverdue).length,
      totalAmount: enrichedInstallments.reduce((sum, i) => sum + i.amount, 0),
      paidAmount: enrichedInstallments.reduce((sum, i) => sum + i.paidAmount, 0),
      remainingAmount: enrichedInstallments.reduce((sum, i) => sum + i.remainingAmount, 0),
    };

    return ApiResponse.success("Parcelas listadas com sucesso.", req, {
      paymentId: payment.id,
      saleId: payment.saleId,
      summary,
      installments: enrichedInstallments,
    });
  }

  // ─── Buscar Parcela por ID ────────────────────────────────────────────────────

  async findById(req: Request) {
    const user = req.user!;
    const { id } = req.params;

    const installment = await this.repo.findInstallmentById(Number(id));
    if (!installment) {
      return ApiResponse.error("Parcela não encontrada.", 404, req);
    }

    if (installment.tenantId !== user.tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar esta parcela.",
        403,
        req
      );
    }

    return ApiResponse.success(
      "Parcela encontrada com sucesso.",
      req,
      this.enrichInstallment(installment)
    );
  }

  // ─── Atualizar Parcela ────────────────────────────────────────────────────────

  async update(req: Request) {
    const user = req.user!;
    const { id } = req.params;
    const data = req.body;
    const userId = user.sub;

    const installment = await this.repo.findInstallmentById(Number(id));
    if (!installment) {
      return ApiResponse.error("Parcela não encontrada.", 404, req);
    }

    if (installment.tenantId !== user.tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar esta parcela.",
        403,
        req
      );
    }

    // Bloquear edição de parcela com pagamento registrado
    if (installment.paidAmount > 0) {
      return ApiResponse.error(
        "Não é possível editar parcelas que já receberam pagamento.",
        400,
        req
      );
    }

    // Validar soma das parcelas do método se amount for alterado
    if (data.amount !== undefined && data.amount !== installment.amount) {
      const methodItem = installment.paymentMethodItem;
      const allInstallments = await this.repo.findInstallmentsByMethodItem(
        methodItem.id
      );

      const newTotal = allInstallments.reduce((sum, inst) => {
        return sum + (inst.id === installment.id ? data.amount : inst.amount);
      }, 0);

      if (Math.abs(newTotal - methodItem.amount) > 0.01) {
        return ApiResponse.error(
          `A soma das parcelas (R$ ${newTotal.toFixed(2)}) deve ser igual ao valor do método (R$ ${methodItem.amount.toFixed(2)}).`,
          400,
          req
        );
      }
    }

    if (data.dueDate && isNaN(new Date(data.dueDate).getTime())) {
      return ApiResponse.error("Data de vencimento inválida.", 400, req);
    }

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

  // ─── Listar Parcelas Vencidas ─────────────────────────────────────────────────

  async findOverdue(req: Request) {
    const user = req.user!;
    const { tenantId } = user;
    const { page = 1, limit = 10 } = req.query;

    const { items, total } = await this.repo.findOverdueInstallments(
      tenantId,
      Number(page),
      Number(limit)
    );

    const now = new Date();
    const enrichedItems = items.map((inst) => {
      const dueDate = inst.dueDate ? new Date(inst.dueDate) : null;
      const daysOverdue = dueDate
        ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        ...inst,
        daysOverdue,
        remainingAmount: inst.amount - inst.paidAmount,
        clientName: inst.paymentMethodItem.payment.sale?.client?.name || "N/A",
        clientPhone: inst.paymentMethodItem.payment.sale?.client?.phone01 || null,
      };
    });

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
