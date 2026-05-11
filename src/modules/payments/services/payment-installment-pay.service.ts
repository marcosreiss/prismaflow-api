// src/modules/payments/services/payment-installment-pay.service.ts

import { Request } from "express";
import { ApiResponse } from "@/responses/ApiResponse";
import { PaymentInstallmentRepository } from "@/modules/payments/repository/payment-installment.repository";
import { PaymentIntegrityService } from "./payment-integrity.service";
import { prisma } from "@/config/prisma-context";
import { PaymentStatus } from "@prisma/client";

export class PaymentInstallmentPayService {
  private installmentRepo = new PaymentInstallmentRepository();
  private integrityService = new PaymentIntegrityService();

  async pay(req: Request) {
    const user = req.user!;
    const { id } = req.params;
    const { sub: userId, tenantId } = user;
    const { paidAmount: amountToPay, paidAt } = req.body;

    const installment = await this.installmentRepo.findById(Number(id));
    if (!installment) {
      return ApiResponse.error("Parcela não encontrada.", 404, req);
    }

    const payment = installment.paymentMethodItem.payment;
    if (payment.tenantId !== tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar esta parcela.",
        403,
        req,
      );
    }

    if (payment.status === PaymentStatus.CANCELED) {
      return ApiResponse.error(
        "Não é possível registrar pagamento em um pagamento cancelado.",
        400,
        req,
      );
    }

    if (installment.paidAt !== null) {
      return ApiResponse.error(
        "Esta parcela já foi totalmente quitada.",
        400,
        req,
      );
    }

    const currentPaid = installment.paidAmount ?? 0;
    const remaining = parseFloat((installment.amount - currentPaid).toFixed(2));

    if (amountToPay > remaining + 0.001) {
      return ApiResponse.error(
        `O valor informado (R$ ${amountToPay.toFixed(2)}) excede o saldo restante da parcela (R$ ${remaining.toFixed(2)}).`,
        400,
        req,
      );
    }

    const newPaidAmount = parseFloat((currentPaid + amountToPay).toFixed(2));
    const isFullyPaid = newPaidAmount >= installment.amount - 0.001;
    const effectivePaidAt = isFullyPaid
      ? paidAt
        ? new Date(paidAt)
        : new Date()
      : undefined;

    await prisma.$transaction(async (tx) => {
      await tx.paymentInstallment.update({
        where: { id: Number(id) },
        data: {
          paidAmount: newPaidAmount,
          ...(effectivePaidAt ? { paidAt: effectivePaidAt } : {}),
          updatedById: userId,
        },
      });

      // Recalcular paidAmount, installmentsPaid e status do Payment dentro da transaction
      const updatedPayment = await tx.payment.findFirst({
        where: { id: payment.id },
        include: {
          methods: {
            include: { installmentItems: true },
          },
        },
      });

      if (!updatedPayment) return;

      const paidFromInstant = updatedPayment.methods
        .filter((m) => m.isPaid)
        .reduce((sum, m) => sum + m.amount, 0);

      const paidFromInstallments = updatedPayment.methods
        .flatMap((m) => m.installmentItems)
        .reduce((sum, i) => {
          // Usa o valor já atualizado para a parcela atual
          if (i.id === Number(id)) return sum + newPaidAmount;
          return sum + (i.paidAmount ?? 0);
        }, 0);

      const totalPaid = parseFloat(
        (paidFromInstant + paidFromInstallments).toFixed(2),
      );

      const installmentsPaid = updatedPayment.methods
        .flatMap((m) => m.installmentItems)
        .filter((i) => {
          if (i.id === Number(id)) return !!effectivePaidAt;
          return i.paidAt !== null;
        }).length;

      const newStatus =
        totalPaid >= updatedPayment.total
          ? PaymentStatus.CONFIRMED
          : PaymentStatus.PENDING;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          paidAmount: totalPaid,
          installmentsPaid,
          status: newStatus,
          ...(effectivePaidAt ? { lastPaymentAt: effectivePaidAt } : {}),
          updatedById: userId,
        },
      });
    });

    const updated = await this.installmentRepo.findById(Number(id));
    return ApiResponse.success(
      "Pagamento da parcela registrado com sucesso.",
      req,
      updated,
    );
  }
}
