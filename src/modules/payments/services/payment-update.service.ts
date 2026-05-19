// src/modules/payments/services/payment-update.service.ts

import { Request } from "express";
import { ApiResponse } from "@/responses/ApiResponse";
import { PaymentRepository } from "@/modules/payments/repository/payment.repository";
import { PaymentIntegrityService } from "./payment-integrity.service";
import { PaymentStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "@/config/prisma-context";
import { getChangedFields } from "@/utils/changed-fields";

const INSTANT_METHODS: PaymentMethod[] = [
  PaymentMethod.PIX,
  PaymentMethod.MONEY,
  PaymentMethod.DEBIT,
  PaymentMethod.CREDIT,
];

export class PaymentUpdateService {
  private repo = new PaymentRepository();
  private integrityService = new PaymentIntegrityService();

  private buildComparablePaymentState(existing: NonNullable<Awaited<ReturnType<PaymentRepository["findById"]>>>) {
    return {
      discount: existing.discount ?? 0,
      methods: existing.methods
        .map((method) => ({
          method: method.method,
          amount: method.amount,
          installments: method.installments ?? null,
          firstDueDate: method.firstDueDate ?? null,
          isPaid: method.isPaid,
          paidAt: method.paidAt ?? null,
        }))
        .sort((a, b) => {
          if (a.method !== b.method) return a.method.localeCompare(b.method);
          return a.amount - b.amount;
        }),
    };
  }

  private getChangedPaymentFields(
    payload: { discount?: number; methods?: any[] },
    existing: NonNullable<Awaited<ReturnType<PaymentRepository["findById"]>>>,
  ) {
    const comparableCurrent = this.buildComparablePaymentState(existing);

    const comparableIncoming = {
      ...(payload.discount !== undefined ? { discount: payload.discount } : {}),
      ...(payload.methods !== undefined
        ? {
            methods: payload.methods
              .map((method) => ({
                method: method.method,
                amount: method.amount,
                installments: method.installments ?? null,
                firstDueDate: method.firstDueDate ?? null,
                isPaid: INSTANT_METHODS.includes(method.method),
                paidAt: INSTANT_METHODS.includes(method.method)
                  ? (method.paidAt ?? null)
                  : null,
              }))
              .sort((a, b) => {
                if (a.method !== b.method) return a.method.localeCompare(b.method);
                return a.amount - b.amount;
              }),
          }
        : {}),
    };

    const changedComparable = getChangedFields<typeof comparableCurrent>(
      comparableIncoming,
      comparableCurrent,
    );

    const changedPayload: { discount?: number; methods?: any[] } = {};

    if ("discount" in changedComparable) {
      changedPayload.discount = payload.discount;
    }

    if ("methods" in changedComparable) {
      changedPayload.methods = payload.methods;
    }

    return changedPayload;
  }

  async update(req: Request) {
    const { id } = req.params;
    const { sub: userId, tenantId, branchId } = req.user!;
    const { discount, methods } = req.body;

    const existing = await this.repo.findById(Number(id), tenantId);
    if (!existing) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    if (existing.status === PaymentStatus.CANCELED) {
      return ApiResponse.error(
        "Não é possível atualizar um pagamento cancelado.",
        400,
        req,
      );
    }

    if (existing.status === PaymentStatus.CONFIRMED) {
      return ApiResponse.error(
        "Não é possível atualizar um pagamento já confirmado.",
        400,
        req,
      );
    }

    const changedFields = this.getChangedPaymentFields(
      { discount, methods },
      existing,
    );

    // ─── Atualização de discount ──────────────────────────────────────────────

    if (changedFields.discount !== undefined) {
      const hasPaidActivity =
        existing.paidAmount > 0 ||
        existing.methods.some((m) => m.isPaid) ||
        existing.methods
          .flatMap((m) => m.installmentItems)
          .some((i) => i.paidAt !== null);

      if (hasPaidActivity) {
        return ApiResponse.error(
          "Não é possível alterar o desconto quando já existem pagamentos registrados.",
          400,
          req,
        );
      }

      const newTotal = parseFloat(
        (existing.subtotal - changedFields.discount).toFixed(2),
      );

      if (existing.methods.length > 0) {
        const sumMethods = existing.methods.reduce(
          (sum, m) => sum + m.amount,
          0,
        );
        if (Math.abs(sumMethods - newTotal) > 0.01) {
          return ApiResponse.error(
            `O novo total (R$ ${newTotal.toFixed(2)}) não bate com a soma dos métodos (R$ ${sumMethods.toFixed(2)}). Remova os métodos antes de alterar o desconto.`,
            400,
            req,
          );
        }
      }

      await this.repo.update(
        Number(id),
        { discount: changedFields.discount, total: newTotal },
        userId,
      );
    }

    // ─── Replace completo de methods[] ───────────────────────────────────────

    const changedMethods = changedFields.methods;

    if (changedMethods?.length) {
      const allInstallments = existing.methods.flatMap(
        (m) => m.installmentItems,
      );
      const hasPaidInstallments = allInstallments.some(
        (i) => i.paidAt !== null,
      );
      const hasPaidMethodItems = existing.methods.some((m) => m.isPaid);

      if (hasPaidInstallments || hasPaidMethodItems) {
        return ApiResponse.error(
          "Não é possível alterar os métodos quando já existem pagamentos registrados.",
          400,
          req,
        );
      }

      if (changedMethods.length > 2) {
        return ApiResponse.error(
          "O Payment aceita no máximo 2 métodos.",
          400,
          req,
        );
      }

      const installmentMethods = changedMethods.filter(
        (m: any) => m.method === PaymentMethod.INSTALLMENT,
      );
      if (installmentMethods.length > 1) {
        return ApiResponse.error(
          "Não é permitido mais de um método do tipo INSTALLMENT.",
          400,
          req,
        );
      }

      const currentTotal = existing.total;
      const sumMethods = changedMethods.reduce(
        (sum: number, m: any) => sum + m.amount,
        0,
      );
      if (Math.abs(sumMethods - currentTotal) > 0.01) {
        return ApiResponse.error(
          `A soma dos métodos (R$ ${sumMethods.toFixed(2)}) deve ser igual ao total do pagamento (R$ ${currentTotal.toFixed(2)}).`,
          400,
          req,
        );
      }

      for (const method of changedMethods) {
        if (method.method === PaymentMethod.INSTALLMENT) {
          if (!method.installments || method.installments < 2) {
            return ApiResponse.error(
              "Método INSTALLMENT requer installments >= 2.",
              400,
              req,
            );
          }
          if (!method.firstDueDate) {
            return ApiResponse.error(
              "Método INSTALLMENT requer firstDueDate.",
              400,
              req,
            );
          }
        }

        if (INSTANT_METHODS.includes(method.method) && !method.paidAt) {
          return ApiResponse.error(
            `O método ${method.method} requer a data de recebimento (paidAt).`,
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

        for (const method of changedMethods) {
          const isInstant = INSTANT_METHODS.includes(method.method);
          await tx.paymentMethodItem.create({
            data: {
              paymentId: Number(id),
              method: method.method,
              amount: method.amount,
              installments:
                method.method === PaymentMethod.INSTALLMENT
                  ? method.installments
                  : null,
              firstDueDate: method.firstDueDate
                ? new Date(method.firstDueDate)
                : null,
              isPaid: isInstant,
              paidAt:
                isInstant && method.paidAt ? new Date(method.paidAt) : null,
              tenantId,
              branchId,
              createdById: userId,
            },
          });
        }
      });

      // Gerar parcelas fora da transaction (usa repo que já tem o context correto)
      const refreshed = await this.repo.findById(Number(id), tenantId);
      for (const methodItem of refreshed!.methods) {
        if (
          methodItem.method === PaymentMethod.INSTALLMENT &&
          methodItem.installments &&
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

      await this.integrityService.recalculatePaymentStatus(Number(id), userId);
    }

    const final = await this.repo.findById(Number(id), tenantId);
    return ApiResponse.success("Pagamento atualizado com sucesso.", req, final);
  }

  async updateStatus(req: Request) {
    const { id } = req.params;
    const { sub: userId, tenantId } = req.user!;
    const { status, reason } = req.body;

    const existing = await this.repo.findById(Number(id), tenantId);
    if (!existing) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    if (existing.status === PaymentStatus.CANCELED) {
      return ApiResponse.error(
        "Não é possível modificar um pagamento cancelado.",
        400,
        req,
      );
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

    const updateData: any = { status };
    if (status === PaymentStatus.CANCELED && reason) {
      updateData.cancelReason = reason;
    }

    // Cancelamento: restaurar estoque dos itens da Sale
    if (status === PaymentStatus.CANCELED) {
      const sale = await prisma.sale.findFirst({
        where: { id: existing.saleId },
        include: { productItems: true },
      });

      if (sale) {
        await prisma.$transaction(async (tx) => {
          for (const item of sale.productItems) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }
          await tx.payment.update({
            where: { id: Number(id) },
            data: { ...updateData, updatedById: userId },
          });
        });
      } else {
        await this.repo.update(Number(id), updateData, userId);
      }
    } else {
      await this.repo.update(Number(id), updateData, userId);
    }

    const updated = await this.repo.findById(Number(id), tenantId);
    return ApiResponse.success(
      "Status do pagamento atualizado com sucesso.",
      req,
      updated,
    );
  }
}
