import { prisma, withAuditData } from "@/config/prisma-context";

export class PaymentInstallmentRepository {
  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(paymentMethodItemId: number, data: any, userId?: string) {
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

  async update(id: number, data: any, userId?: string) {
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

  async findById(id: number) {
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

  async findByMethodItemId(paymentMethodItemId: number) {
    return prisma.paymentInstallment.findMany({
      where: { paymentMethodItemId },
      orderBy: { sequence: "asc" },
    });
  }

  async softDelete(id: number, userId?: string) {
    return prisma.paymentInstallment.update({
      where: { id },
      data: withAuditData(userId, { isActive: false }, true),
    });
  }

  async deleteByMethodItemId(paymentMethodItemId: number) {
    return prisma.paymentInstallment.deleteMany({
      where: { paymentMethodItemId },
    });
  }

  // ─── Parcelas Vencidas ────────────────────────────────────────────────────

  async findOverdue(tenantId: string, page: number, limit: number) {
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
}
