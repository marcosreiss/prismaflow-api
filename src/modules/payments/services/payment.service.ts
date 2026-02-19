import { Request } from "express";
import { ApiResponse } from "../../../responses/ApiResponse";
import { PagedResponse } from "../../../responses/PagedResponse";
import { PaymentRepository } from "../payment.repository";
import { PaymentIntegrityService } from "./payment-integrity.service";
import { PaymentStatus } from "@prisma/client";

export class PaymentService {
  private repo = new PaymentRepository();
  private integrityService = new PaymentIntegrityService();

  // ─── Listar Pagamentos (Paginado + Filtros) ──────────────────────────────────

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

    // Enriquecer cada pagamento com métricas calculadas a partir dos métodos
    const now = new Date();
    const enrichedItems = items.map((payment) => {
      const allInstallments = payment.methods.flatMap((m) => m.installmentItems);

      const overdueInstallments = allInstallments.filter(
        (inst) =>
          inst.dueDate &&
          new Date(inst.dueDate) < now &&
          inst.paidAt === null
      );

      const nextDueInstallment = allInstallments
        .filter(
          (inst) =>
            inst.dueDate &&
            new Date(inst.dueDate) >= now &&
            inst.paidAt === null
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

  // ─── Buscar por ID ───────────────────────────────────────────────────────────

  async findById(req: Request) {
    const { id } = req.params;

    const payment = await this.repo.findById(Number(id));
    if (!payment) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    return ApiResponse.success("Pagamento encontrado com sucesso.", req, payment);
  }

  // ─── Status do Pagamento por Sale ID ────────────────────────────────────────

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

  // ─── Criar Pagamento ─────────────────────────────────────────────────────────

  async create(req: Request) {
    const user = req.user!;
    const { sub: userId, tenantId, branchId } = user;
    const data = req.body;

    // Validar soma dos métodos === total
    if (data.methods?.length) {
      const sumMethods = data.methods.reduce(
        (sum: number, m: any) => sum + m.amount,
        0
      );

      if (Math.abs(sumMethods - data.total) > 0.01) {
        return ApiResponse.error(
          `A soma dos métodos (R$ ${sumMethods.toFixed(2)}) deve ser igual ao total (R$ ${data.total.toFixed(2)}).`,
          400,
          req
        );
      }
    }

    const payment = await this.repo.create(
      { ...data, tenantId, branchId },
      userId
    );

    // Gerar parcelas para métodos parcelados
    for (const methodItem of payment.methods) {
      if (methodItem.installments && methodItem.installments > 0 && methodItem.firstDueDate) {
        await this.integrityService.generateInstallments(
          {
            id: methodItem.id,
            amount: methodItem.amount,
            installments: methodItem.installments,
            firstDueDate: methodItem.firstDueDate,
          },
          { tenantId, branchId, userId }
        );
      }
    }

    const final = await this.repo.findById(payment.id);

    return ApiResponse.success("Pagamento criado com sucesso.", req, final);
  }

  // ─── Deletar Pagamento ───────────────────────────────────────────────────────

  async delete(req: Request) {
    const user = req.user!;
    const { id } = req.params;
    const userId = user.sub;

    const payment = await this.repo.findById(Number(id));
    if (!payment) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    // Somente pagamentos PENDING podem ser removidos
    if (payment.status !== PaymentStatus.PENDING) {
      return ApiResponse.error(
        "Somente pagamentos com status PENDING podem ser excluídos.",
        400,
        req
      );
    }

    await this.repo.softDelete(Number(id), userId);

    return ApiResponse.success("Pagamento removido com sucesso.", req);
  }
}
