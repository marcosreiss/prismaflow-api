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
    }
  ) {
    const skip = (page - 1) * limit;
    const where: any = { tenantId };

    // ✅ Filtros existentes
    if (filters?.status) where.status = filters.status;
    if (filters?.method) where.method = filters.method;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    // ✅ NOVOS FILTROS POR CLIENTE
    if (filters?.clientId || filters?.clientName) {
      where.sale = {
        client: {}
      };

      if (filters.clientId) where.sale.client.id = filters.clientId;
      if (filters.clientName) where.sale.client.name = { contains: filters.clientName };
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
              client: { select: { id: true, name: true } } // ✅ Incluir dados do cliente
            }
          },
          installments: true,
        },
      }),
      prisma.payment.count({ where }),
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
}
