import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { PaymentRepository } from "./payment.repository";
import { prisma, withAuditData } from "../../config/prisma-context";
import { PaymentMethod, PaymentStatus } from "@prisma/client";

export class PaymentService {
  private repo = new PaymentRepository();

  // ======================================================
  // LISTAR PAGAMENTOS (Paginado + Filtros)
  // ======================================================

  async findAll(req: Request) {
    const user = req.user!;
    const { tenantId } = user;
    const {
      page = 1,
      limit = 10,
      status,
      method,
      startDate,
      endDate,
      clientId,
      clientName,
      hasOverdueInstallments,
      isPartiallyPaid,
      dueDaysAhead,
    } = req.query;

    const { items, total } = await this.repo.findAllByTenant(
      tenantId,
      Number(page),
      Number(limit),
      {
        status: status ? String(status) : undefined,
        method: method ? String(method) : undefined,
        startDate: startDate ? new Date(String(startDate)) : undefined,
        endDate: endDate ? new Date(String(endDate)) : undefined,
        clientId: clientId ? Number(clientId) : undefined,
        clientName: clientName ? String(clientName) : undefined,
        hasOverdueInstallments: hasOverdueInstallments === "true",
        isPartiallyPaid: isPartiallyPaid === "true",
        dueDaysAhead: dueDaysAhead ? Number(dueDaysAhead) : undefined,
      }
    );

    // Enriquecer dados com informações calculadas
    const enrichedItems = items.map((payment) => {
      const now = new Date();
      const overdueInstallments = payment.installments.filter(
        (inst) =>
          inst.dueDate &&
          new Date(inst.dueDate) < now &&
          inst.paidAmount < inst.amount
      );

      const nextDueInstallment = payment.installments
        .filter(
          (inst) =>
            inst.dueDate &&
            new Date(inst.dueDate) >= now &&
            inst.paidAmount < inst.amount
        )
        .sort(
          (a, b) =>
            new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
        )[0];

      return {
        ...payment,
        hasOverdueInstallments: overdueInstallments.length > 0,
        overdueCount: overdueInstallments.length,
        nextDueDate: nextDueInstallment?.dueDate || null,
        nextDueAmount: nextDueInstallment?.amount || null,
      };
    });

    return new PagedResponse(
      "Pagamentos listados com sucesso.",
      req,
      enrichedItems,
      Number(page),
      Number(limit),
      total
    );
  }

  // ======================================================
  // BUSCAR POR ID
  // ======================================================
  async findById(req: Request) {
    const { id } = req.params;
    const payment = await this.repo.findById(Number(id));

    if (!payment) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    // Carrega também informações detalhadas da venda e cliente
    const sale = await prisma.sale.findUnique({
      where: { id: payment.saleId },
      include: {
        client: { select: { id: true, name: true } },
      },
    });

    const details = {
      ...payment,
      sale: sale
        ? {
            id: sale.id,
            subtotal: sale.subtotal,
            discount: sale.discount,
            total: sale.total,
            notes: sale.notes,
            clientName: sale.client?.name,
          }
        : null,
    };

    return ApiResponse.success(
      "Pagamento encontrado com sucesso.",
      req,
      details
    );
  }

  // ======================================================
  // STATUS DO PAGAMENTO POR SALE ID
  // ======================================================
  async findStatusBySaleId(req: Request) {
    const { saleId } = req.params;
    const payment = await this.repo.findBySaleId(Number(saleId));

    if (!payment) {
      return ApiResponse.error(
        "Pagamento não encontrado para esta venda.",
        404,
        req
      );
    }

    return ApiResponse.success("Status do pagamento obtido com sucesso.", req, {
      saleId: payment.saleId,
      paymentId: payment.id,
      status: payment.status,
    });
  }

  // ======================================================
  // CRIAR PAGAMENTO (opcional — normalmente feito via SaleService)
  // ======================================================
  async create(req: Request) {
    const user = req.user!;
    const { sub: userId, tenantId, branchId } = user;
    const data = req.body;

    const payment = await this.repo.create(
      {
        ...data,
        tenantId,
        branchId,
      },
      userId
    );

    return ApiResponse.success("Pagamento criado com sucesso.", req, payment);
  }

  // ======================================================
  // ATUALIZAR PAGAMENTO
  // ======================================================
  async update(req: Request) {
    const user = req.user!;
    const { id } = req.params;
    const userId = user.sub;
    const { tenantId, branchId } = user;
    const data = req.body;

    // 1️⃣ Verificar se pagamento existe
    const existing = await this.repo.findById(Number(id));
    if (!existing) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    // 2️⃣ Validar permissão (tenant)
    if (existing.tenantId !== user.tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar este pagamento.",
        403,
        req
      );
    }

    // 3️⃣ Validar se pode ser atualizado (status deve ser PENDING para maioria das alterações)
    if (existing.status === PaymentStatus.CANCELED) {
      return ApiResponse.error(
        "Não é possível atualizar um pagamento cancelado.",
        400,
        req
      );
    }

    if (
      existing.status === PaymentStatus.CONFIRMED &&
      data.status !== PaymentStatus.CANCELED
    ) {
      // Pagamento confirmado só pode ser cancelado
      const allowedFields = ["status"];
      const attemptedFields = Object.keys(data);
      const blockedFields = attemptedFields.filter(
        (f) => !allowedFields.includes(f)
      );

      if (blockedFields.length > 0) {
        return ApiResponse.error(
          `Pagamento confirmado só pode ter o status alterado. Campos bloqueados: ${blockedFields.join(
            ", "
          )}`,
          400,
          req
        );
      }
    }

    // 4️⃣ Verificar se já tem parcelas criadas
    const existingInstallments = await this.repo.findInstallmentsByPayment(
      Number(id)
    );
    const hasInstallments = existingInstallments.length > 0;

    // 5️⃣ VALIDAÇÕES SE JÁ TEM PARCELAS
    if (hasInstallments) {
      const hasPaidInstallments = existingInstallments.some(
        (inst) => inst.paidAmount > 0
      );

      // 5.1 - Se alguma parcela foi paga
      if (hasPaidInstallments) {
        const blockedFields = [
          "method",
          "installmentsTotal",
          "total",
          "discount",
          "downPayment",
          "firstDueDate",
        ];
        const attemptedFields = Object.keys(data);
        const invalidFields = attemptedFields.filter((f) =>
          blockedFields.includes(f)
        );

        if (invalidFields.length > 0) {
          return ApiResponse.error(
            `Pagamento com parcelas já pagas não pode ter os seguintes campos alterados: ${invalidFields.join(
              ", "
            )}. Apenas o status pode ser modificado.`,
            400,
            req
          );
        }

        // Apenas permite alterar status
        const allowedFields = ["status"];
        const notAllowedFields = attemptedFields.filter(
          (f) => !allowedFields.includes(f)
        );

        if (notAllowedFields.length > 0) {
          return ApiResponse.error(
            `Pagamento com parcelas pagas só permite alteração de status. Campos não permitidos: ${notAllowedFields.join(
              ", "
            )}`,
            400,
            req
          );
        }
      } else {
        // 5.2 - Se tem parcelas mas nenhuma foi paga
        const blockedFields = [
          "total",
          "installmentsTotal",
          "discount",
          "downPayment",
        ];
        const attemptedFields = Object.keys(data);
        const invalidFields = attemptedFields.filter((f) =>
          blockedFields.includes(f)
        );

        if (invalidFields.length > 0) {
          return ApiResponse.error(
            `Pagamento com parcelas criadas não pode ter os seguintes campos alterados: ${invalidFields.join(
              ", "
            )}. Para modificar estes valores, exclua as parcelas primeiro ou edite-as individualmente.`,
            400,
            req
          );
        }

        // Permite: method, status, firstDueDate
        const allowedFields = ["method", "status", "firstDueDate"];
        const notAllowedFields = attemptedFields.filter(
          (f) =>
            !allowedFields.includes(f) && !["tenantId", "branchId"].includes(f)
        );

        if (notAllowedFields.length > 0) {
          return ApiResponse.error(
            `Apenas os campos ${allowedFields.join(
              ", "
            )} podem ser alterados quando há parcelas criadas. Campos não permitidos: ${notAllowedFields.join(
              ", "
            )}`,
            400,
            req
          );
        }
      }
    }

    // 6️⃣ Se método = INSTALLMENT, validar campos obrigatórios
    if (
      data.method === PaymentMethod.INSTALLMENT ||
      (existing.method === PaymentMethod.INSTALLMENT && !data.method)
    ) {
      const installmentsTotal =
        data.installmentsTotal ?? existing.installmentsTotal;
      const firstDueDate = data.firstDueDate ?? existing.firstDueDate;
      const total = data.total ?? existing.total;
      const discount = data.discount ?? existing.discount ?? 0;
      const downPayment = data.downPayment ?? existing.downPayment ?? 0;

      if (!installmentsTotal || installmentsTotal < 1) {
        return ApiResponse.error(
          "Para pagamento parcelado, é necessário informar o número de parcelas (mínimo 1).",
          400,
          req
        );
      }

      if (!firstDueDate) {
        return ApiResponse.error(
          "Para pagamento parcelado, é necessário informar a data do primeiro vencimento (firstDueDate).",
          400,
          req
        );
      }

      const amountToInstall = total - discount - downPayment;

      if (amountToInstall <= 0) {
        return ApiResponse.error(
          "O valor a parcelar (total - desconto - entrada) deve ser maior que zero.",
          400,
          req
        );
      }
    }

    // 7️⃣ Validar mudança de método se já tem parcelas
    if (hasInstallments && data.method && data.method !== existing.method) {
      return ApiResponse.error(
        `Não é possível alterar o método de pagamento de ${existing.method} para ${data.method} quando já existem parcelas criadas. Exclua as parcelas primeiro.`,
        400,
        req
      );
    }

    // 8️⃣ Atualizar o pagamento
    const updated = await this.repo.update(Number(id), data, userId);

    // 9️⃣ Se método = INSTALLMENT e ainda não tem parcelas, gerar agora
    if (updated.method === PaymentMethod.INSTALLMENT && !hasInstallments) {
      await this.generateInstallments(updated, tenantId, branchId, userId);
    }

    // 🔟 Recarregar com parcelas
    const final = await this.repo.findById(Number(id));

    return ApiResponse.success("Pagamento atualizado com sucesso.", req, final);
  }

  // ======================================================
  // GERAR PARCELAS AUTOMATICAMENTE
  // ======================================================
  private async generateInstallments(
    payment: any,
    tenantId: string,
    branchId: string,
    userId: string
  ) {
    const {
      id,
      total,
      discount,
      downPayment,
      installmentsTotal,
      firstDueDate,
    } = payment;

    const amountToInstall = total - (discount || 0) - (downPayment || 0);
    const installmentValue = amountToInstall / installmentsTotal;

    const installments = [];
    const baseDueDate = new Date(firstDueDate);

    for (let i = 1; i <= installmentsTotal; i++) {
      const dueDate = new Date(baseDueDate);
      dueDate.setDate(dueDate.getDate() + (i - 1) * 30);

      const installment = await this.repo.createInstallment(
        id,
        {
          sequence: i,
          amount: parseFloat(installmentValue.toFixed(2)),
          paidAmount: 0,
          dueDate,
          tenantId,
          branchId,
        },
        userId
      );

      installments.push(installment);
    }

    // ✅ VALIDAR INTEGRIDADE APÓS CRIAR PARCELAS
    const validation = await this.validateInstallmentsIntegrity(id);
    if (!validation.valid) {
      // Se houver inconsistência, logar erro mas não bloquear
      console.error(
        `[AVISO] Inconsistência detectada no pagamento ${id}: ${validation.error}`
      );
    }

    return installments;
  }

  // ======================================================
  // VALIDAR INTEGRIDADE DAS PARCELAS
  // ======================================================
  private async validateInstallmentsIntegrity(paymentId: number) {
    const payment = await this.repo.findById(paymentId);
    if (!payment) {
      return { valid: false, error: "Pagamento não encontrado." };
    }

    const installments = await this.repo.findInstallmentsByPayment(paymentId);

    // Se não tem parcelas e não é parcelamento, está ok
    if (installments.length === 0) {
      if (payment.method === PaymentMethod.INSTALLMENT) {
        return {
          valid: false,
          error: "Pagamento parcelado sem parcelas criadas.",
        };
      }
      return { valid: true }; // Métodos não-parcelados não precisam de parcelas
    }

    const issues = [];

    // 1️⃣ Validar quantidade de parcelas
    if (installments.length !== payment.installmentsTotal) {
      issues.push({
        field: "installmentsTotal",
        expected: payment.installmentsTotal,
        found: installments.length,
        message: `Número de parcelas incorreto. Esperado: ${payment.installmentsTotal}, Encontrado: ${installments.length}`,
      });
    }

    // 2️⃣ Validar soma dos valores
    const totalInstallments = installments.reduce(
      (sum, inst) => sum + inst.amount,
      0
    );
    const expectedTotal =
      payment.total - (payment.discount || 0) - (payment.downPayment || 0);

    // Tolerância de 1 centavo por arredondamento
    if (Math.abs(totalInstallments - expectedTotal) > 0.01) {
      issues.push({
        field: "amount",
        expected: expectedTotal,
        found: totalInstallments,
        difference: Math.abs(totalInstallments - expectedTotal),
        message: `Soma das parcelas incorreta. Esperado: R$ ${expectedTotal.toFixed(
          2
        )}, Encontrado: R$ ${totalInstallments.toFixed(
          2
        )}, Diferença: R$ ${Math.abs(totalInstallments - expectedTotal).toFixed(
          2
        )}`,
      });
    }

    // 3️⃣ Validar sequência das parcelas
    const sequences = installments.map((i) => i.sequence).sort((a, b) => a - b);
    const expectedSequences = Array.from(
      { length: installments.length },
      (_, i) => i + 1
    );
    const hasSequenceGap = !sequences.every(
      (seq, idx) => seq === expectedSequences[idx]
    );

    if (hasSequenceGap) {
      issues.push({
        field: "sequence",
        expected: expectedSequences,
        found: sequences,
        message: `Sequência de parcelas com lacunas ou duplicadas. Esperado: [${expectedSequences.join(
          ", "
        )}], Encontrado: [${sequences.join(", ")}]`,
      });
    }

    // 4️⃣ Validar parcelas sem data de vencimento
    const installmentsWithoutDueDate = installments.filter((i) => !i.dueDate);
    if (installmentsWithoutDueDate.length > 0) {
      issues.push({
        field: "dueDate",
        message: `${installmentsWithoutDueDate.length} parcela(s) sem data de vencimento.`,
        installments: installmentsWithoutDueDate.map((i) => i.id),
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

  // ======================================================
  // ENDPOINT DE VALIDAÇÃO DE INTEGRIDADE
  // ======================================================
  async validate(req: Request) {
    const user = req.user!;
    const { id } = req.params;

    // 1️⃣ Buscar pagamento
    const payment = await this.repo.findById(Number(id));
    if (!payment) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    // 2️⃣ Verificar permissão
    if (payment.tenantId !== user.tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar este pagamento.",
        403,
        req
      );
    }

    // 3️⃣ Executar validação
    const validation = await this.validateInstallmentsIntegrity(Number(id));

    // 4️⃣ Buscar dados adicionais
    const installments = await this.repo.findInstallmentsByPayment(Number(id));

    // 5️⃣ Calcular estatísticas
    const stats = {
      paymentId: payment.id,
      saleId: payment.saleId,
      method: payment.method,
      status: payment.status,
      total: payment.total,
      discount: payment.discount || 0,
      downPayment: payment.downPayment || 0,
      amountToInstall:
        payment.total - (payment.discount || 0) - (payment.downPayment || 0),
      installmentsTotal: payment.installmentsTotal,
      installmentsCreated: installments.length,
      installmentsPaid: payment.installmentsPaid,
      paidAmount: payment.paidAmount,
      sumOfInstallments: installments.reduce((sum, i) => sum + i.amount, 0),
    };

    if (validation.valid) {
      return ApiResponse.success("Pagamento íntegro e consistente.", req, {
        valid: true,
        stats,
        installments: installments.map((i) => ({
          id: i.id,
          sequence: i.sequence,
          amount: i.amount,
          paidAmount: i.paidAmount,
          dueDate: i.dueDate,
          isPaid: i.paidAmount >= i.amount,
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
        installments: installments.map((i) => ({
          id: i.id,
          sequence: i.sequence,
          amount: i.amount,
          paidAmount: i.paidAmount,
          dueDate: i.dueDate,
          isPaid: i.paidAmount >= i.amount,
        })),
      }
    );
  }

  // ======================================================
  // DELETAR PAGAMENTO
  // ======================================================
  async delete(req: Request) {
    const user = req.user!;
    const { id } = req.params;
    const userId = user.sub;

    const payment = await this.repo.findById(Number(id));
    if (!payment) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      return ApiResponse.error(
        "Somente pagamentos com status PENDING podem ser excluídos.",
        400,
        req
      );
    }

    // Soft delete
    await this.repo.softDelete(Number(id), userId);

    return ApiResponse.success("Pagamento removido com sucesso.", req);
  }

  async updateStatus(req: Request) {
    const user = req.user!;
    const { id } = req.params;
    const { status, reason } = req.body;
    const userId = user.sub;

    const existing = await this.repo.findById(Number(id));
    if (!existing) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    // 🔐 Validações de regra de negócio
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

    // 📝 Se for cancelamento, registrar motivo
    const updateData: any = { status };
    if (status === PaymentStatus.CANCELED && reason) {
      updateData.cancelReason = reason;
    }

    // Se for confirmação, atualizar paidAmount
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
}
