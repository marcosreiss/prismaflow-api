// src/modules/payments/services/payment.service.ts

import { Request } from "express";
import { ApiResponse } from "@/responses/ApiResponse";
import { PagedResponse } from "@/responses/PagedResponse";
import { PaymentRepository } from "@/modules/payments/repository/payment.repository";
import { PaymentIntegrityService } from "./payment-integrity.service";

export class PaymentService {
  private repo = new PaymentRepository();
  private integrityService = new PaymentIntegrityService();

  async findAll(req: Request) {
    const { tenantId } = req.user!;
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
      sortOrder,
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
        sortOrder: sortOrder === "asc" ? "asc" : "desc",
      },
    );

    const now = new Date();
    const enrichedItems = items.map((payment) => {
      const allInstallments = payment.methods.flatMap(
        (m) => m.installmentItems,
      );

      const overdueInstallments = allInstallments.filter(
        (i) => i.dueDate && new Date(i.dueDate) < now && i.paidAt === null,
      );

      const nextDue = allInstallments
        .filter(
          (i) => i.dueDate && new Date(i.dueDate) >= now && i.paidAt === null,
        )
        .sort(
          (a, b) =>
            new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime(),
        )[0];

      return {
        ...payment,
        hasOverdueInstallments: overdueInstallments.length > 0,
        overdueCount: overdueInstallments.length,
        nextDueDate: nextDue?.dueDate ?? null,
        nextDueAmount: nextDue?.amount ?? null,
      };
    });

    return new PagedResponse(
      "Pagamentos listados com sucesso.",
      req,
      enrichedItems,
      Number(page),
      Number(limit),
      total,
    );
  }

  async findById(req: Request) {
    const { id } = req.params;
    const { tenantId } = req.user!;

    const payment = await this.repo.findById(Number(id), tenantId);
    if (!payment) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    return ApiResponse.success(
      "Pagamento encontrado com sucesso.",
      req,
      payment,
    );
  }

  async findStatusBySaleId(req: Request) {
    const { saleId } = req.params;

    const payment = await this.repo.findBySaleId(Number(saleId));
    if (!payment) {
      return ApiResponse.error(
        "Pagamento não encontrado para esta venda.",
        404,
        req,
      );
    }

    return ApiResponse.success("Status do pagamento obtido com sucesso.", req, {
      saleId: payment.saleId,
      paymentId: payment.id,
      status: payment.status,
    });
  }

  async validate(req: Request) {
    const { id } = req.params;
    const { tenantId } = req.user!;

    const payment = await this.repo.findById(Number(id), tenantId);
    if (!payment) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    const validation = await this.integrityService.validatePaymentIntegrity(
      Number(id),
    );

    const allInstallments = payment.methods.flatMap((m) => m.installmentItems);
    const stats = {
      paymentId: payment.id,
      saleId: payment.saleId,
      status: payment.status,
      subtotal: payment.subtotal,
      total: payment.total,
      discount: payment.discount ?? 0,
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
      validation.error ?? "Inconsistências detectadas no pagamento.",
      400,
      req,
      { valid: false, stats, issues: validation.issues },
    );
  }
}
