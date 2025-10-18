import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { PaymentRepository } from "./payment.repository";
import { prisma, withAuditData } from "../../config/prisma-context";
import { PaymentStatus } from "@prisma/client";

export class PaymentService {
  private repo = new PaymentRepository();

  // ======================================================
  // LISTAR PAGAMENTOS (Paginado + Filtro por status)
  // ======================================================
  // payment.service.ts - Modifique o método findAll
  // payment.service.ts - Modifique o método findAll
  async findAll(req: Request) {
    const user = req.user!;
    const { tenantId } = user;
    const { page = 1, limit = 10, status, method, startDate, endDate, clientId, clientName } = req.query;

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

    const existing = await this.repo.findById(Number(id));
    if (!existing) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    if (existing.status !== PaymentStatus.PENDING) {
      return ApiResponse.error(
        "Somente pagamentos com status PENDING podem ser atualizados.",
        400,
        req
      );
    }

    const updated = await this.repo.update(Number(id), req.body, userId);

    return ApiResponse.success(
      "Pagamento atualizado com sucesso.",
      req,
      updated
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

  // PaymentService - Adicione este método
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
    if (existing.status === PaymentStatus.CONFIRMED && status === PaymentStatus.PENDING) {
      return ApiResponse.error(
        "Não é possível reabrir um pagamento já confirmado.",
        400,
        req
      );
    }

    if (existing.status === PaymentStatus.CANCELED && status !== PaymentStatus.CANCELED) {
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

