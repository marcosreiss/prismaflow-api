import { Request } from "express";
import { ApiResponse } from "../../../responses/ApiResponse";
import { PaymentRepository } from "../payment.repository";
import { PaymentIntegrityService } from "./payment-integrity.service";
import { PaymentStatus } from "@prisma/client";

export class PaymentUpdateService {
  private repo = new PaymentRepository();
  private integrityService = new PaymentIntegrityService();

  // ─── Atualizar Pagamento ─────────────────────────────────────────────────────

  async update(req: Request) {
    const user = req.user!;
    const { id } = req.params;
    const { sub: userId, tenantId, branchId } = user;
    const data = req.body;

    const existing = await this.repo.findById(Number(id));
    if (!existing) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    if (existing.tenantId !== tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar este pagamento.",
        403,
        req
      );
    }

    if (existing.status === PaymentStatus.CANCELED) {
      return ApiResponse.error(
        "Não é possível atualizar um pagamento cancelado.",
        400,
        req
      );
    }

    // Pagamento confirmado só permite cancelamento
    if (
      existing.status === PaymentStatus.CONFIRMED &&
      data.status !== PaymentStatus.CANCELED
    ) {
      const blockedFields = Object.keys(data).filter((f) => f !== "status");
      if (blockedFields.length > 0) {
        return ApiResponse.error(
          `Pagamento confirmado só pode ter o status alterado. Campos bloqueados: ${blockedFields.join(", ")}`,
          400,
          req
        );
      }
    }

    // Validar alterações em methods[] se fornecido
    if (data.methods) {
      const allInstallments = existing.methods.flatMap((m) => m.installmentItems);
      const hasPaidInstallments = allInstallments.some(
        (inst) => inst.paidAt !== null
      );

      if (hasPaidInstallments) {
        return ApiResponse.error(
          "Não é possível alterar os métodos de pagamento quando já existem parcelas pagas.",
          400,
          req
        );
      }

      // Validar soma dos métodos === total informado
      const newTotal = data.total ?? existing.total;
      const sumMethods = data.methods.reduce(
        (sum: number, m: any) => sum + m.amount,
        0
      );

      if (Math.abs(sumMethods - newTotal) > 0.01) {
        return ApiResponse.error(
          `A soma dos métodos (R$ ${sumMethods.toFixed(2)}) deve ser igual ao total do pagamento (R$ ${newTotal.toFixed(2)}).`,
          400,
          req
        );
      }
    }

    const updated = await this.repo.update(Number(id), data, userId);

    // Gerar parcelas para novos métodos parcelados sem parcelas ainda
    if (data.methods) {
      for (const methodItem of updated.methods) {
        const hasInstallments = methodItem.installmentItems.length > 0;

        if (methodItem.installments && methodItem.installments > 0 && !hasInstallments) {
          await this.integrityService.generateInstallments(
            {
              id: methodItem.id,
              amount: methodItem.amount,
              installments: methodItem.installments,
              firstDueDate: methodItem.firstDueDate!,
            },
            { tenantId, branchId, userId }
          );
        }
      }
    }

    const final = await this.repo.findById(Number(id));

    return ApiResponse.success("Pagamento atualizado com sucesso.", req, final);
  }

  // ─── Atualizar Status ────────────────────────────────────────────────────────

  async updateStatus(req: Request) {
    const user = req.user!;
    const { id } = req.params;
    const { status, reason } = req.body;
    const userId = user.sub;

    const existing = await this.repo.findById(Number(id));
    if (!existing) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    if (
      existing.status === PaymentStatus.CONFIRMED &&
      status === PaymentStatus.PENDING
    ) {
      return ApiResponse.error(
        "Não é possível reabrir um pagamento já confirmado.",
        400,
        req
      );
    }

    if (
      existing.status === PaymentStatus.CANCELED &&
      status !== PaymentStatus.CANCELED
    ) {
      return ApiResponse.error(
        "Não é possível modificar um pagamento cancelado.",
        400,
        req
      );
    }

    const updateData: any = { status };

    if (status === PaymentStatus.CANCELED && reason) {
      updateData.cancelReason = reason;
    }

    // Confirmação manual: consolidar paidAmount pelo total líquido
    if (status === PaymentStatus.CONFIRMED) {
      updateData.paidAmount = existing.total - (existing.discount || 0);
      updateData.lastPaymentAt = new Date();
    }

    const updated = await this.repo.update(Number(id), updateData, userId);

    return ApiResponse.success(
      "Status do pagamento atualizado com sucesso.",
      req,
      updated
    );
  }

  // ─── Validar Integridade (endpoint público) ──────────────────────────────────

  async validate(req: Request) {
    const user = req.user!;
    const { id } = req.params;

    const payment = await this.repo.findById(Number(id));
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

    const validation = await this.integrityService.validatePaymentIntegrity(Number(id));

    // Estatísticas calculadas a partir dos métodos
    const allInstallments = payment.methods.flatMap((m) => m.installmentItems);
    const stats = {
      paymentId: payment.id,
      saleId: payment.saleId,
      status: payment.status,
      total: payment.total,
      discount: payment.discount || 0,
      methodsCount: payment.methods.length,
      sumMethods: payment.methods.reduce((sum, m) => sum + m.amount, 0),
      installmentsCreated: allInstallments.length,
      installmentsPaid: payment.installmentsPaid,
      paidAmount: payment.paidAmount,
    };

    if (validation.valid) {
      return ApiResponse.success("Pagamento íntegro e consistente.", req, {
        valid: true,
        stats,
        methods: payment.methods.map((m) => ({
          id: m.id,
          method: m.method,
          amount: m.amount,
          installments: m.installments,
          installmentItems: m.installmentItems.map((i) => ({
            id: i.id,
            sequence: i.sequence,
            amount: i.amount,
            paidAmount: i.paidAmount,
            dueDate: i.dueDate,
            isPaid: i.paidAt !== null,
          })),
        })),
      });
    }

    return ApiResponse.error(
      validation.error || "Inconsistências detectadas no pagamento.",
      400,
      req,
      {
        valid: false,
        stats,
        issues: validation.issues,
      }
    );
  }
}
