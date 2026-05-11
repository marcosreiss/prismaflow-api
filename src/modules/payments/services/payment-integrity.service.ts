// src/modules/payments/services/payment-integrity.service.ts

import { prisma } from "@/config/prisma-context";
import { PaymentRepository } from "@/modules/payments/repository/payment.repository";
import { PaymentInstallmentRepository } from "@/modules/payments/repository/payment-installment.repository";
import { PaymentMethod, PaymentStatus } from "@prisma/client";

const INSTANT_METHODS: PaymentMethod[] = [
  PaymentMethod.PIX,
  PaymentMethod.MONEY,
  PaymentMethod.DEBIT,
  PaymentMethod.CREDIT,
];

export class PaymentIntegrityService {
  private paymentRepo = new PaymentRepository();
  private installmentRepo = new PaymentInstallmentRepository();

  // ─── Gerar Parcelas ───────────────────────────────────────────────────────────

  async generateInstallments(
    methodItem: {
      id: number;
      amount: number;
      installments: number;
      firstDueDate: Date;
    },
    context: { tenantId: string; branchId: string; userId: string },
  ) {
    const {
      id: paymentMethodItemId,
      amount,
      installments,
      firstDueDate,
    } = methodItem;
    const { tenantId, branchId, userId } = context;

    const installmentValue = Math.floor((amount / installments) * 100) / 100;
    const remainder = parseFloat(
      (amount - installmentValue * installments).toFixed(2),
    );

    const baseDate = new Date(firstDueDate);
    const created = [];

    for (let i = 1; i <= installments; i++) {
      const dueDate = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth() + (i - 1),
        baseDate.getDate(),
      );

      // Se o dia não existir no mês destino (ex: 31 em fevereiro), usa último dia do mês
      if (dueDate.getDate() !== baseDate.getDate()) {
        dueDate.setDate(0);
      }

      const isLast = i === installments;
      const installmentAmount = parseFloat(
        (installmentValue + (isLast ? remainder : 0)).toFixed(2),
      );

      const installment = await this.installmentRepo.create(
        paymentMethodItemId,
        {
          sequence: i,
          amount: installmentAmount,
          paidAmount: 0,
          dueDate,
          tenantId,
          branchId,
        },
        userId,
      );

      created.push(installment);
    }

    return created;
  }

  // ─── Recalcular Status do Payment ────────────────────────────────────────────

  async recalculatePaymentStatus(paymentId: number, userId?: string) {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) return;

    const paidFromInstant = payment.methods
      .filter(
        (m) => INSTANT_METHODS.includes(m.method as PaymentMethod) && m.isPaid,
      )
      .reduce((sum, m) => sum + m.amount, 0);

    const paidFromInstallments = payment.methods
      .flatMap((m) => m.installmentItems)
      .reduce((sum, i) => sum + (i.paidAmount ?? 0), 0);

    const paidAmount = parseFloat(
      (paidFromInstant + paidFromInstallments).toFixed(2),
    );

    const installmentsPaid = payment.methods
      .flatMap((m) => m.installmentItems)
      .filter((i) => i.paidAt !== null).length;

    const status =
      paidAmount >= payment.total
        ? PaymentStatus.CONFIRMED
        : PaymentStatus.PENDING;

    await this.paymentRepo.update(
      paymentId,
      { paidAmount, installmentsPaid, status },
      userId,
    );
  }

  // ─── Validar Integridade de um PaymentMethodItem ─────────────────────────────

  async validateMethodItemIntegrity(paymentMethodItemId: number) {
    const installments =
      await this.installmentRepo.findByMethodItemId(paymentMethodItemId);
    if (installments.length === 0) return { valid: true };

    const issues: any[] = [];

    const sequences = installments.map((i) => i.sequence).sort((a, b) => a - b);
    const expectedSequences = Array.from(
      { length: installments.length },
      (_, i) => i + 1,
    );
    if (!sequences.every((seq, idx) => seq === expectedSequences[idx])) {
      issues.push({
        field: "sequence",
        message: `Sequência com lacunas. Esperado: [${expectedSequences.join(", ")}], Encontrado: [${sequences.join(", ")}]`,
      });
    }

    const withoutDueDate = installments.filter((i) => !i.dueDate);
    if (withoutDueDate.length > 0) {
      issues.push({
        field: "dueDate",
        message: `${withoutDueDate.length} parcela(s) sem data de vencimento.`,
      });
    }

    return issues.length > 0 ? { valid: false, issues } : { valid: true };
  }

  // ─── Validar Integridade Completa do Payment ─────────────────────────────────

  async validatePaymentIntegrity(paymentId: number) {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) return { valid: false, error: "Pagamento não encontrado." };

    const issues: any[] = [];

    const sumMethods = payment.methods.reduce((sum, m) => sum + m.amount, 0);
    if (Math.abs(sumMethods - payment.total) > 0.01) {
      issues.push({
        field: "methods",
        message: `Soma dos métodos (${sumMethods.toFixed(2)}) difere do total (${payment.total.toFixed(2)}).`,
      });
    }

    const paidFromInstant = payment.methods
      .filter((m) => m.isPaid)
      .reduce((sum, m) => sum + m.amount, 0);

    const paidFromInstallments = payment.methods
      .flatMap((m) => m.installmentItems)
      .reduce((sum, i) => sum + (i.paidAmount ?? 0), 0);

    const realPaidAmount = parseFloat(
      (paidFromInstant + paidFromInstallments).toFixed(2),
    );
    if (Math.abs(realPaidAmount - payment.paidAmount) > 0.01) {
      issues.push({
        field: "paidAmount",
        message: `paidAmount registrado (${payment.paidAmount}) difere do calculado (${realPaidAmount}).`,
      });
    }

    for (const method of payment.methods) {
      const methodIssues = await this.validateMethodItemIntegrity(method.id);
      if (!methodIssues.valid) issues.push(...(methodIssues.issues ?? []));
    }

    return issues.length > 0
      ? { valid: false, error: "Inconsistências detectadas.", issues }
      : { valid: true };
  }
}
