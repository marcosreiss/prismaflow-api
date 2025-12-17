import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { PaymentRepository } from "./payment.repository";
import { prisma, withAuditData } from "../../config/prisma-context";
import { PaymentMethod, PaymentStatus } from "@prisma/client";

export class PaymentService {
  private repo = new PaymentRepository();

  // ======================================================
  // LISTAR PAGAMENTOS (Paginado + Filtro por status)
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
      }
    );

    return new PagedResponse(
      "Pagamentos listados com sucesso.",
      req,
      items,
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

    // 2️⃣ Validar se pode ser atualizado
    if (existing.status !== PaymentStatus.PENDING) {
      return ApiResponse.error(
        "Somente pagamentos com status PENDING podem ser atualizados.",
        400,
        req
      );
    }

    // 3️⃣ Verificar se já tem parcelas criadas
    const existingInstallments = await this.repo.findInstallmentsByPayment(
      Number(id)
    );
    const hasInstallments = existingInstallments.length > 0;

    // 4️⃣ Se já tem parcelas, validar o que pode ser alterado
    if (hasInstallments) {
      const hasPaidInstallments = existingInstallments.some(
        (inst) => inst.paidAmount > 0
      );

      if (hasPaidInstallments) {
        // Se tem parcelas pagas, só pode mudar status
        const allowedFields = ["status"];
        const attemptedFields = Object.keys(data);
        const blockedFields = attemptedFields.filter(
          (f) => !allowedFields.includes(f)
        );

        if (blockedFields.length > 0) {
          return ApiResponse.error(
            `Pagamento com parcelas pagas não pode ter os seguintes campos alterados: ${blockedFields.join(
              ", "
            )}`,
            400,
            req
          );
        }
      } else {
        // Se tem parcelas mas nenhuma paga, bloqueia alteração de valores críticos
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
            `Pagamento com parcelas já criadas não pode ter os seguintes campos alterados: ${invalidFields.join(
              ", "
            )}. Exclua as parcelas primeiro.`,
            400,
            req
          );
        }
      }
    }

    // 5️⃣ Se método = INSTALLMENT, validar campos obrigatórios
    if (data.method === PaymentMethod.INSTALLMENT) {
      if (!data.installmentsTotal || data.installmentsTotal < 1) {
        return ApiResponse.error(
          "Para pagamento parcelado, é necessário informar o número de parcelas (mínimo 1).",
          400,
          req
        );
      }

      if (!data.firstDueDate) {
        return ApiResponse.error(
          "Para pagamento parcelado, é necessário informar a data do primeiro vencimento (firstDueDate).",
          400,
          req
        );
      }

      const total = data.total ?? existing.total;
      const discount = data.discount ?? existing.discount ?? 0;
      const downPayment = data.downPayment ?? existing.downPayment ?? 0;

      const amountToInstall = total - discount - downPayment;

      if (amountToInstall <= 0) {
        return ApiResponse.error(
          "O valor a parcelar (total - desconto - entrada) deve ser maior que zero.",
          400,
          req
        );
      }
    }

    // 6️⃣ Atualizar o pagamento
    const updated = await this.repo.update(Number(id), data, userId);

    // 7️⃣ Se método = INSTALLMENT e ainda não tem parcelas, gerar agora
    if (updated.method === PaymentMethod.INSTALLMENT && !hasInstallments) {
      await this.generateInstallments(updated, tenantId, branchId, userId);
    }

    // 8️⃣ Recarregar com parcelas
    const final = await this.repo.findById(Number(id));

    return ApiResponse.success("Pagamento atualizado com sucesso.", req, final);
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

    // Calcular valor total a parcelar
    const amountToInstall = total - (discount || 0) - (downPayment || 0);

    // Calcular valor de cada parcela
    const installmentValue = amountToInstall / installmentsTotal;

    // Gerar as parcelas
    const installments = [];
    const baseDueDate = new Date(firstDueDate);

    for (let i = 1; i <= installmentsTotal; i++) {
      // Calcular data de vencimento (incremento de 30 dias)
      const dueDate = new Date(baseDueDate);
      dueDate.setDate(dueDate.getDate() + (i - 1) * 30);

      // Criar parcela
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

    return installments;
  }
}
