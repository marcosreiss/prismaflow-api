// src/modules/payments/repository/payment-installment.repository.ts

import { prisma, withAuditData } from "@/config/prisma-context";

const installmentInclude = {
  paymentMethodItem: {
    select: {
      id: true,
      method: true,
      amount: true,
      payment: {
        select: {
          id: true,
          saleId: true,
          total: true,
          status: true,
          tenantId: true,
        },
      },
    },
  },
} as const;

export class PaymentInstallmentRepository {
  async create(paymentMethodItemId: number, data: any, userId?: string) {
    return prisma.paymentInstallment.create({
      data: withAuditData(userId, { ...data, paymentMethodItemId }),
      include: installmentInclude,
    });
  }

  async update(id: number, data: any, userId?: string) {
    return prisma.paymentInstallment.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: installmentInclude,
    });
  }

  async findById(id: number) {
    return prisma.paymentInstallment.findUnique({
      where: { id },
      include: installmentInclude,
    });
  }

  async findByMethodItemId(paymentMethodItemId: number) {
    return prisma.paymentInstallment.findMany({
      where: { paymentMethodItemId },
      orderBy: { sequence: "asc" },
    });
  }

  async deleteByMethodItemId(paymentMethodItemId: number) {
    return prisma.paymentInstallment.deleteMany({
      where: { paymentMethodItemId },
    });
  }

  async findOverdue(tenantId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = {
      tenantId,
      dueDate: { lt: new Date() },
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
}
