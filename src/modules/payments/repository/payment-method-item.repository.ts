// src/modules/payments/repository/payment-method-item.repository.ts

import { PaymentMethod } from "@prisma/client";
import { prisma, withAuditData } from "@/config/prisma-context";

const methodItemInclude = {
  installmentItems: { orderBy: { sequence: "asc" } },
} as const;

export class PaymentMethodItemRepository {
  async create(
    data: {
      paymentId: number;
      method: PaymentMethod;
      amount: number;
      installments?: number | null;
      firstDueDate?: Date | null;
      isPaid?: boolean;
      paidAt?: Date | null;
      tenantId: string;
      branchId: string;
    },
    userId?: string,
  ) {
    return prisma.paymentMethodItem.create({
      data: withAuditData(userId, data),
      include: methodItemInclude,
    });
  }

  async update(id: number, data: any, userId?: string) {
    return prisma.paymentMethodItem.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: methodItemInclude,
    });
  }

  async findById(id: number) {
    return prisma.paymentMethodItem.findUnique({
      where: { id },
      include: methodItemInclude,
    });
  }

  async findByPaymentId(paymentId: number) {
    return prisma.paymentMethodItem.findMany({
      where: { paymentId },
      include: methodItemInclude,
    });
  }

  async delete(id: number) {
    return prisma.paymentMethodItem.delete({ where: { id } });
  }

  async deleteByPaymentId(paymentId: number) {
    return prisma.paymentMethodItem.deleteMany({ where: { paymentId } });
  }
}
