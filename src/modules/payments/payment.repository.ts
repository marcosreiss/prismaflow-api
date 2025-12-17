import { PaymentStatus } from "@prisma/client";
import { prisma, withAuditData } from "../../config/prisma-context";

export class PaymentRepository {
  async create(data: any, userId?: string) {
    return prisma.payment.create({
      data: withAuditData(userId, data),
      include: {
        sale: { select: { id: true, clientId: true, total: true } },
        installments: true,
      },
    });
  }

  async update(id: number, data: any, userId?: string) {
    return prisma.payment.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: {
        sale: { select: { id: true, clientId: true, total: true } },
        installments: true,
      },
    });
  }

  async findById(id: number) {
    return prisma.payment.findUnique({
      where: { id },
      include: {
        sale: { select: { id: true, clientId: true, total: true } },
        installments: true,
      },
    });
  }

  async findBySaleId(saleId: number) {
    return prisma.payment.findUnique({
      where: { saleId },
      include: {
        installments: true,
      },
    });
  }

  async findAllByTenant(
    tenantId: string,
    page: number,
    limit: number,
    filters?: {
      status?: string;
      method?: string;
      startDate?: Date;
      endDate?: Date;
      clientId?: number;
      clientName?: string;
      hasOverdueInstallments?: boolean;
      isPartiallyPaid?: boolean;
      dueDaysAhead?: number;
    }
  ) {
    const skip = (page - 1) * limit;
    const where: any = { tenantId };

    // Filtros existentes
    if (filters?.status) where.status = filters.status;
    if (filters?.method) where.method = filters.method;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    // Filtros por cliente
    if (filters?.clientId || filters?.clientName) {
      where.sale = {
        client: {},
      };

      if (filters.clientId) where.sale.client.id = filters.clientId;
      if (filters.clientName)
        where.sale.client.name = { contains: filters.clientName };
    }

    // ✅ NOVOS FILTROS

    // Filtro: Parcialmente pago
    if (filters?.isPartiallyPaid) {
      where.AND = where.AND || [];
      where.AND.push({
        installmentsPaid: { gt: 0 },
        status: PaymentStatus.PENDING,
      });
    }

    // Filtro: Com parcelas vencidas
    if (filters?.hasOverdueInstallments) {
      where.installments = {
        some: {
          dueDate: { lt: new Date() },
          paidAmount: { lt: prisma.paymentInstallment.fields.amount },
        },
      };
    }

    // Filtro: Próximas a vencer
    if (filters?.dueDaysAhead) {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + filters.dueDaysAhead);

      where.installments = {
        some: {
          dueDate: {
            gte: today,
            lte: futureDate,
          },
          paidAmount: { lt: prisma.paymentInstallment.fields.amount },
        },
      };
    }

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          sale: {
            select: {
              id: true,
              clientId: true,
              total: true,
              client: { select: { id: true, name: true } },
            },
          },
          installments: {
            orderBy: { sequence: "asc" },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return { items, total };
  }

  // ✅ NOVO MÉTODO: Buscar parcelas vencidas
  async findOverdueInstallments(tenantId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const now = new Date();

    const where = {
      tenantId,
      dueDate: { lt: now },
      paidAmount: { lt: prisma.paymentInstallment.fields.amount },
      isActive: true,
    };

    const [items, total] = await Promise.all([
      prisma.paymentInstallment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: "asc" },
        include: {
          payment: {
            select: {
              id: true,
              saleId: true,
              status: true,
              method: true,
              sale: {
                select: {
                  id: true,
                  client: {
                    select: {
                      id: true,
                      name: true,
                      phone01: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.paymentInstallment.count({ where }),
    ]);

    return { items, total };
  }

  async findInstallmentsByPayment(paymentId: number) {
    return prisma.paymentInstallment.findMany({
      where: { paymentId },
      orderBy: { sequence: "asc" },
    });
  }

  async createInstallment(paymentId: number, data: any, userId?: string) {
    return prisma.paymentInstallment.create({
      data: withAuditData(userId, { ...data, paymentId }),
      include: {
        payment: { select: { id: true, saleId: true } },
      },
    });
  }

  async updateInstallment(id: number, data: any, userId?: string) {
    return prisma.paymentInstallment.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: {
        payment: { select: { id: true, saleId: true } },
      },
    });
  }

  async softDelete(id: number, userId?: string) {
    return prisma.payment.update({
      where: { id },
      data: withAuditData(userId, { isActive: false }, true),
    });
  }

  async softDeleteInstallment(id: number, userId?: string) {
    return prisma.paymentInstallment.update({
      where: { id },
      data: withAuditData(userId, { isActive: false }, true),
    });
  }

  async findInstallmentById(id: number) {
    return prisma.paymentInstallment.findUnique({
      where: { id },
      include: {
        payment: {
          select: {
            id: true,
            saleId: true,
            total: true,
            status: true,
            method: true,
          },
        },
      },
    });
  }
}
