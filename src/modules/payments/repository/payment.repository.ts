// src/modules/payments/repository/payment.repository.ts

import { PaymentStatus } from "@prisma/client";
import { prisma, withAuditData } from "@/config/prisma-context";

const paymentInclude = {
  sale: {
    select: {
      id: true,
      saleDate: true,
      clientId: true,
      total: true,
      client: { select: { id: true, name: true } },
    },
  },
  methods: {
    include: { installmentItems: { orderBy: { sequence: "asc" } } },
  },
} as const;

export class PaymentRepository {
  async create(data: any, userId?: string) {
    return prisma.payment.create({
      data: withAuditData(userId, data),
      include: paymentInclude,
    });
  }

  async update(id: number, data: any, userId?: string) {
    return prisma.payment.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: paymentInclude,
    });
  }

  async findById(id: number, tenantId?: string) {
    return prisma.payment.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      include: paymentInclude,
    });
  }

  async findBySaleId(saleId: number) {
    return prisma.payment.findUnique({
      where: { saleId },
      include: paymentInclude,
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
      sortOrder?: "asc" | "desc";
    },
  ) {
    const skip = (page - 1) * limit;
    const where: any = { tenantId, sale: {} };

    if (filters?.status) where.status = filters.status;
    if (filters?.method) where.methods = { some: { method: filters.method } };

    if (filters?.startDate || filters?.endDate) {
      where.sale.saleDate = {};
      if (filters?.startDate) where.sale.saleDate.gte = filters.startDate;
      if (filters?.endDate) where.sale.saleDate.lte = filters.endDate;
    }

    if (filters?.clientId || filters?.clientName) {
      where.sale.client = {};
      if (filters?.clientId) where.sale.client.id = filters.clientId;
      if (filters?.clientName)
        where.sale.client.name = { contains: filters.clientName };
    }

    if (filters?.isPartiallyPaid) {
      where.AND = [
        { installmentsPaid: { gt: 0 }, status: PaymentStatus.PENDING },
      ];
    }

    if (filters?.hasOverdueInstallments) {
      where.methods = {
        some: {
          installmentItems: {
            some: { dueDate: { lt: new Date() }, isActive: true, paidAt: null },
          },
        },
      };
    }

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
        orderBy: { sale: { saleDate: filters?.sortOrder ?? "desc" } },
        include: paymentInclude,
      }),
      prisma.payment.count({ where }),
    ]);

    return { items, total };
  }
}
