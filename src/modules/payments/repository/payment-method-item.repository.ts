import { PaymentMethod } from "@prisma/client";
import { prisma, withAuditData } from "@/config/prisma-context";

export class PaymentMethodItemRepository {
  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(
    data: {
      paymentId: number;
      method: PaymentMethod;
      amount: number;
      installments?: number;
      firstDueDate?: Date;
      tenantId: string;
      branchId: string;
    },
    userId?: string,
  ) {
    return prisma.paymentMethodItem.create({
      data: withAuditData(userId, data),
      include: { installmentItems: { orderBy: { sequence: "asc" } } },
    });
  }

  async update(id: number, data: any, userId?: string) {
    return prisma.paymentMethodItem.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: { installmentItems: { orderBy: { sequence: "asc" } } },
    });
  }

  async findById(id: number) {
    return prisma.paymentMethodItem.findUnique({
      where: { id },
      include: { installmentItems: { orderBy: { sequence: "asc" } } },
    });
  }

  async findByPaymentId(paymentId: number) {
    return prisma.paymentMethodItem.findMany({
      where: { paymentId },
      include: { installmentItems: { orderBy: { sequence: "asc" } } },
    });
  }

  async delete(id: number) {
    return prisma.paymentMethodItem.delete({ where: { id } });
  }

  async deleteByPaymentId(paymentId: number) {
    return prisma.paymentMethodItem.deleteMany({ where: { paymentId } });
  }
}
