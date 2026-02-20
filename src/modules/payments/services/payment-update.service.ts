import { Request } from "express";
import { ApiResponse } from "@/responses/ApiResponse";
import { PaymentRepository } from "@/modules/payments/repository/payment.repository";
import { PaymentMethodItemRepository } from "@/modules/payments/repository/payment-method-item.repository";
import { PaymentInstallmentRepository } from "@/modules/payments/repository/payment-installment.repository";
import { PaymentIntegrityService } from "./payment-integrity.service";
import { PaymentStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "@/config/prisma-context";

const INSTANT_METHODS: PaymentMethod[] = [
  PaymentMethod.PIX,
  PaymentMethod.MONEY,
  PaymentMethod.DEBIT,
  PaymentMethod.CREDIT,
];

export class PaymentUpdateService {
  private repo = new PaymentRepository();
  private methodItemRepo = new PaymentMethodItemRepository();
  private installmentRepo = new PaymentInstallmentRepository();
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
        req,
      );
    }

    if (existing.status === PaymentStatus.CANCELED) {
      return ApiResponse.error(
        "Não é possível atualizar um pagamento cancelado.",
        400,
        req,
      );
    }

    if (
      existing.status === PaymentStatus.CONFIRMED &&
      data.status !== PaymentStatus.CANCELED
    ) {
      const blockedFields = Object.keys(data).filter((f) => f !== "status");
      if (blockedFields.length > 0) {
        return ApiResponse.error(
          `Pagamento confirmado só pode ter o status alterado. Campos bloqueados: ${blockedFields.join(", ")}`,
          400,
          req,
        );
      }
    }

    // ─── Replace completo de methods[] ───────────────────────────────────────

    if (data.methods?.length) {
      const allInstallments = existing.methods.flatMap(
        (m) => m.installmentItems,
      );
      const hasPaidInstallments = allInstallments.some(
        (inst) => inst.paidAt !== null,
      );
      const hasPaidMethodItems = existing.methods.some((m) => m.isPaid);

      if (hasPaidInstallments || hasPaidMethodItems) {
        return ApiResponse.error(
          "Não é possível alterar os métodos de pagamento quando já existem pagamentos registrados.",
          400,
          req,
        );
      }

      const newTotal = data.total ?? existing.total;
      const sumMethods = data.methods.reduce(
        (sum: number, m: any) => sum + m.amount,
        0,
      );

      if (Math.abs(sumMethods - newTotal) > 0.01) {
        return ApiResponse.error(
          `A soma dos métodos (R$ ${sumMethods.toFixed(2)}) deve ser igual ao total (R$ ${newTotal.toFixed(2)}).`,
          400,
          req,
        );
      }

      for (const method of data.methods) {
        if (
          method.installments &&
          method.installments > 0 &&
          !method.firstDueDate
        ) {
          return ApiResponse.error(
            `O método ${method.method} é parcelado mas não possui firstDueDate.`,
            400,
            req,
          );
        }

        // Métodos à vista exigem paidAt informado pelo front
        if (INSTANT_METHODS.includes(method.method) && !method.paidAt) {
          return ApiResponse.error(
            `O método ${method.method} requer a data de pagamento (paidAt).`,
            400,
            req,
          );
        }
      }

      await prisma.$transaction(async (tx) => {
        const existingMethodIds = existing.methods.map((m) => m.id);

        await tx.paymentInstallment.deleteMany({
          where: { paymentMethodItemId: { in: existingMethodIds } },
        });

        await tx.paymentMethodItem.deleteMany({
          where: { paymentId: Number(id) },
        });

        for (const method of data.methods) {
          const isInstant = INSTANT_METHODS.includes(method.method);

          await tx.paymentMethodItem.create({
            data: {
              paymentId: Number(id),
              method: method.method,
              amount: method.amount,
              installments: method.installments || null,
              firstDueDate: method.firstDueDate
                ? new Date(method.firstDueDate)
                : null,
              isPaid: isInstant,
              paidAt: isInstant ? new Date(method.paidAt) : null,
              tenantId,
              branchId,
              createdById: userId,
            },
          });
        }
      });

      // Gerar parcelas para métodos parcelados após a transaction
      const updatedPayment = await this.repo.findById(Number(id));
      for (const methodItem of updatedPayment!.methods) {
        if (
          methodItem.installments &&
          methodItem.installments > 0 &&
          methodItem.firstDueDate
        ) {
          await this.integrityService.generateInstallments(
            {
              id: methodItem.id,
              amount: methodItem.amount,
              installments: methodItem.installments,
              firstDueDate: methodItem.firstDueDate,
            },
            { tenantId, branchId, userId },
          );
        }
      }

      // Recalcular paidAmount após configurar métodos
      await this.integrityService.recalculatePaymentStatus(Number(id), userId);
    }

    const { methods, ...paymentData } = data;
    await this.repo.update(Number(id), paymentData, userId);

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
        req,
      );
    }

    if (
      existing.status === PaymentStatus.CANCELED &&
      status !== PaymentStatus.CANCELED
    ) {
      return ApiResponse.error(
        "Não é possível modificar um pagamento cancelado.",
        400,
        req,
      );
    }

    const updateData: any = { status };

    if (status === PaymentStatus.CANCELED && reason) {
      updateData.cancelReason = reason;
    }

    // Confirmação manual: recalcular com base nos métodos e parcelas reais
    if (status === PaymentStatus.CONFIRMED) {
      await this.integrityService.recalculatePaymentStatus(Number(id), userId);
      updateData.status = PaymentStatus.CONFIRMED;
      updateData.lastPaymentAt = new Date();
    }

    const updated = await this.repo.update(Number(id), updateData, userId);

    return ApiResponse.success(
      "Status do pagamento atualizado com sucesso.",
      req,
      updated,
    );
  }

  // ─── Validar Integridade ─────────────────────────────────────────────────────

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
        req,
      );
    }

    const validation = await this.integrityService.validatePaymentIntegrity(
      Number(id),
    );

    const allInstallments = payment.methods.flatMap((m) => m.installmentItems);
    const stats = {
      paymentId: payment.id,
      saleId: payment.saleId,
      status: payment.status,
      total: payment.total,
      discount: payment.discount || 0,
      methodsCount: payment.methods.length,
      sumMethods: payment.methods.reduce((sum, m) => sum + m.amount, 0),
      instantMethodsPaid: payment.methods.filter((m) => m.isPaid).length,
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
          isPaid: m.isPaid,
          paidAt: m.paidAt,
          installments: m.installments,
          installmentItems: m.installmentItems.map((i) => ({
            id: i.id,
            sequence: i.sequence,
            amount: i.amount,
            paidAmount: i.paidAmount,
            dueDate: i.dueDate,
            isPaid: i.paidAt !== null,
            paidAt: i.paidAt,
          })),
        })),
      });
    }

    return ApiResponse.error(
      validation.error || "Inconsistências detectadas no pagamento.",
      400,
      req,
      { valid: false, stats, issues: validation.issues },
    );
  }
}
