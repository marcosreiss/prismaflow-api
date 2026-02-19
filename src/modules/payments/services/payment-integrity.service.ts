import { PaymentRepository } from "../payment.repository";

export class PaymentIntegrityService {
  private repo = new PaymentRepository();

  // ─── Gerar Parcelas por PaymentMethodItem ────────────────────────────────────

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

    const installmentValue = amount / installments;
    const baseDueDate = new Date(firstDueDate);
    const created = [];

    for (let i = 1; i <= installments; i++) {
      const dueDate = new Date(baseDueDate);
      dueDate.setDate(dueDate.getDate() + (i - 1) * 30);

      const installment = await this.repo.createInstallment(
        paymentMethodItemId,
        {
          sequence: i,
          amount: parseFloat(installmentValue.toFixed(2)),
          paidAmount: 0,
          dueDate,
          tenantId,
          branchId,
        },
        userId,
      );

      created.push(installment);
    }

    // Validar integridade logo após geração
    const validation =
      await this.validateMethodItemIntegrity(paymentMethodItemId);
    if (!validation.valid) {
      console.error(
        `[AVISO] Inconsistência no PaymentMethodItem ${paymentMethodItemId}: ${validation.error}`,
      );
    }

    return created;
  }

  // ─── Validar Integridade de um PaymentMethodItem ─────────────────────────────

  async validateMethodItemIntegrity(paymentMethodItemId: number) {
    const installments =
      await this.repo.findInstallmentsByMethodItem(paymentMethodItemId);

    if (installments.length === 0) {
      return { valid: true }; // Métodos não-parcelados não têm parcelas
    }

    const issues = [];

    // Validar sequência contínua sem lacunas
    const sequences = installments.map((i) => i.sequence).sort((a, b) => a - b);
    const expectedSequences = Array.from(
      { length: installments.length },
      (_, i) => i + 1,
    );
    const hasSequenceGap = !sequences.every(
      (seq, idx) => seq === expectedSequences[idx],
    );

    if (hasSequenceGap) {
      issues.push({
        field: "sequence",
        expected: expectedSequences,
        found: sequences,
        message: `Sequência com lacunas. Esperado: [${expectedSequences.join(", ")}], Encontrado: [${sequences.join(", ")}]`,
      });
    }

    // Validar parcelas sem data de vencimento
    const withoutDueDate = installments.filter((i) => !i.dueDate);
    if (withoutDueDate.length > 0) {
      issues.push({
        field: "dueDate",
        message: `${withoutDueDate.length} parcela(s) sem data de vencimento.`,
        installments: withoutDueDate.map((i) => i.id),
      });
    }

    if (issues.length > 0) {
      return {
        valid: false,
        error: `${issues.length} inconsistência(s) detectada(s)`,
        issues,
      };
    }

    return { valid: true };
  }

  // ─── Validar Integridade Completa de um Payment ──────────────────────────────

  async validatePaymentIntegrity(paymentId: number) {
    const payment = await this.repo.findById(paymentId);
    if (!payment) {
      return { valid: false, error: "Pagamento não encontrado." };
    }

    const issues = [];

    // Validar se há métodos cadastrados
    if (!payment.methods || payment.methods.length === 0) {
      return { valid: false, error: "Pagamento sem métodos cadastrados." };
    }

    // Validar soma dos métodos === payment.total
    const sumMethods = payment.methods.reduce((sum, m) => sum + m.amount, 0);
    if (Math.abs(sumMethods - payment.total) > 0.01) {
      issues.push({
        field: "total",
        expected: payment.total,
        found: sumMethods,
        difference: Math.abs(sumMethods - payment.total),
        message: `Soma dos métodos (R$ ${sumMethods.toFixed(2)}) diverge do total (R$ ${payment.total.toFixed(2)})`,
      });
    }

    // Validar integridade de cada método parcelado
    for (const method of payment.methods) {
      if (method.installments && method.installments > 0) {
        const methodValidation = await this.validateMethodItemIntegrity(
          method.id,
        );
        if (!methodValidation.valid) {
          issues.push({
            field: `methodItem#${method.id}`,
            method: method.method,
            ...methodValidation,
          });
        }

        // Validar soma das parcelas === amount do método
        const sumInstallments = method.installmentItems.reduce(
          (sum, i) => sum + i.amount,
          0,
        );
        if (Math.abs(sumInstallments - method.amount) > 0.01) {
          issues.push({
            field: `methodItem#${method.id}.amount`,
            expected: method.amount,
            found: sumInstallments,
            message: `Soma das parcelas do método ${method.method} (R$ ${sumInstallments.toFixed(2)}) diverge do amount (R$ ${method.amount.toFixed(2)})`,
          });
        }
      }
    }

    if (issues.length > 0) {
      return {
        valid: false,
        error: `${issues.length} inconsistência(s) detectada(s)`,
        issues,
      };
    }

    return { valid: true, payment };
  }

  // ─── Recalcular Status do Payment com base em todos os métodos ───────────────

  async recalculatePaymentStatus(paymentId: number, userId: string) {
    const payment = await this.repo.findById(paymentId);
    if (!payment || !payment.methods) return;

    // Achatar todas as parcelas de todos os métodos
    const allInstallments = payment.methods.flatMap((m) => m.installmentItems);

    if (allInstallments.length === 0) return;

    const installmentsPaid = allInstallments.filter(
      (inst) => inst.paidAt !== null,
    ).length;

    const totalPaidAmount = allInstallments.reduce(
      (sum, inst) => sum + inst.paidAmount,
      0,
    );

    const allPaid = allInstallments.every((inst) => inst.paidAt !== null);

    // Buscar última data de pagamento entre todas as parcelas
    const paidInstallments = allInstallments.filter((inst) => inst.paidAt);
    const lastPaymentAt =
      paidInstallments.length > 0
        ? paidInstallments.reduce((latest, inst) => {
            const instDate = new Date(inst.paidAt!);
            return instDate > latest ? instDate : latest;
          }, new Date(paidInstallments[0].paidAt!))
        : null;

    const newStatus = allPaid ? "CONFIRMED" : "PENDING";

    await this.repo.update(
      paymentId,
      {
        installmentsPaid,
        paidAmount: totalPaidAmount,
        lastPaymentAt,
        status: newStatus,
      },
      userId,
    );
  }
}
