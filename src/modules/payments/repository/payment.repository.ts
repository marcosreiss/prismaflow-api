import { PaymentStatus } from "@prisma/client";
import { prisma, withAuditData } from "../../config/prisma-context";

export class PaymentRepository {
  // ─── Payment CRUD ───────────────────────────────────────────────────────────

  async create(data: any, userId?: string) {
    return prisma.payment.create({
      data: withAuditData(userId, data),
      include: {
        sale: { select: { id: true, clientId: true, total: true } },
        methods: {
          include: { installmentItems: { orderBy: { sequence: "asc" } } },
        },
      },
    });
  }

  async update(id: number, data: any, userId?: string) {
    return prisma.payment.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: {
        sale: { select: { id: true, clientId: true, total: true } },
        methods: {
          include: { installmentItems: { orderBy: { sequence: "asc" } } },
        },
      },
    });
  }

  async findById(id: number) {
    return prisma.payment.findUnique({
      where: { id },
      include: {
        sale: { select: { id: true, clientId: true, total: true } },
        methods: {
          include: { installmentItems: { orderBy: { sequence: "asc" } } },
        },
      },
    });
  }

  async findBySaleId(saleId: number) {
    return prisma.payment.findUnique({
      where: { saleId },
      include: {
        methods: {
          include: { installmentItems: { orderBy: { sequence: "asc" } } },
        },
      },
    });
  }

  async softDelete(id: number, userId?: string) {
    return prisma.payment.update({
      where: { id },
      data: withAuditData(userId, { isActive: false }, true),
    });
  }

  // ─── Listagem e Filtros ──────────────────────────────────────────────────────

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
    },
  ) {
    const skip = (page - 1) * limit;
    const where: any = { tenantId };

    if (filters?.status) where.status = filters.status;

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    // Filtro por cliente via Sale
    if (filters?.clientId || filters?.clientName) {
      where.sale = { client: {} };
      if (filters.clientId) where.sale.client.id = filters.clientId;
      if (filters.clientName)
        where.sale.client.name = { contains: filters.clientName };
    }

    // Filtro por método dentro de PaymentMethodItem
    if (filters?.method) {
      where.methods = { some: { method: filters.method } };
    }

    // Filtro: Parcialmente pago (possui parcelas pagas mas ainda PENDING)
    if (filters?.isPartiallyPaid) {
      where.AND = where.AND || [];
      where.AND.push({
        installmentsPaid: { gt: 0 },
        status: PaymentStatus.PENDING,
      });
    }

    // Filtro: Com parcelas vencidas e não totalmente pagas
    if (filters?.hasOverdueInstallments) {
      where.methods = {
        some: {
          installmentItems: {
            some: {
              dueDate: { lt: new Date() },
              isActive: true,
              paidAt: null,
            },
          },
        },
      };
    }

    // Filtro: Parcelas a vencer nos próximos X dias
    if (filters?.dueDaysAhead) {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + filters.dueDaysAhead);

      where.methods = {
        some: {
          installmentItems: {
            some: {
              dueDate: { gte: today, lte: futureDate },
              isActive: true,
              paidAt: null,
            },
          },
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
          methods: {
            include: { installmentItems: { orderBy: { sequence: "asc" } } },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return { items, total };
  }

  // ─── Parcelas Vencidas ───────────────────────────────────────────────────────

  async findOverdueInstallments(tenantId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const now = new Date();

    const where = {
      tenantId,
      dueDate: { lt: now },
      paidAt: null,
      isActive: true,
    };

    const [items, total] = await Promise.all([
      prisma.paymentInstallment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: "asc" },
        include: {
          paymentMethodItem: {
            include: {
              payment: {
                select: {
                  id: true,
                  saleId: true,
                  status: true,
                  sale: {
                    select: {
                      id: true,
                      client: {
                        select: { id: true, name: true, phone01: true },
                      },
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

  // ─── Installment CRUD ────────────────────────────────────────────────────────

  async findInstallmentsByMethodItem(paymentMethodItemId: number) {
    return prisma.paymentInstallment.findMany({
      where: { paymentMethodItemId },
      orderBy: { sequence: "asc" },
    });
  }

  async createInstallment(
    paymentMethodItemId: number,
    data: any,
    userId?: string,
  ) {
    return prisma.paymentInstallment.create({
      data: withAuditData(userId, { ...data, paymentMethodItemId }),
      include: {
        paymentMethodItem: {
          select: {
            id: true,
            method: true,
            payment: { select: { id: true, saleId: true } },
          },
        },
      },
    });
  }

  async updateInstallment(id: number, data: any, userId?: string) {
    return prisma.paymentInstallment.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: {
        paymentMethodItem: {
          select: {
            id: true,
            method: true,
            payment: { select: { id: true, saleId: true } },
          },
        },
      },
    });
  }

  async findInstallmentById(id: number) {
    return prisma.paymentInstallment.findUnique({
      where: { id },
      include: {
        paymentMethodItem: {
          select: {
            id: true,
            method: true,
            amount: true,
            payment: {
              select: { id: true, saleId: true, total: true, status: true },
            },
          },
        },
      },
    });
  }

  async softDeleteInstallment(id: number, userId?: string) {
    return prisma.paymentInstallment.update({
      where: { id },
      data: withAuditData(userId, { isActive: false }, true),
    });
  }
}
