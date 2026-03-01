import { prisma } from "../../config/prisma-context";

export class DashboardRepository {
  private baseWhere(
    tenantId: string,
    branchId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    return {
      tenantId,
      ...(branchId ? { branchId } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    };
  }

  async getBalance(
    tenantId: string,
    branchId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where = this.baseWhere(tenantId, branchId, startDate, endDate);

    const [payments, expenses] = await Promise.all([
      prisma.payment.aggregate({
        where: { ...where, status: "CONFIRMED" },
        _sum: { paidAmount: true },
      }),
      prisma.expense.aggregate({
        where: { ...where, status: "PAID" },
        _sum: { amount: true },
      }),
    ]);

    const revenue = payments._sum.paidAmount ?? 0;
    const totalExpenses = expenses._sum.amount ?? 0;

    return {
      revenue,
      expenses: totalExpenses,
      netProfit: revenue - totalExpenses,
    };
  }

  async getSalesSummary(
    tenantId: string,
    branchId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where = this.baseWhere(tenantId, branchId, startDate, endDate);

    const result = await prisma.sale.aggregate({
      where,
      _count: { id: true },
      _sum: { total: true },
      _avg: { total: true },
    });

    return {
      count: result._count.id,
      totalRevenue: result._sum.total ?? 0,
      averageTicket: result._avg.total ?? 0,
    };
  }

  async getPaymentsByStatus(
    tenantId: string,
    branchId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where = this.baseWhere(tenantId, branchId, startDate, endDate);

    return prisma.payment.groupBy({
      by: ["status"],
      where,
      _count: { id: true },
      _sum: { total: true },
    });
  }

  async getTopProducts(
    tenantId: string,
    branchId?: string,
    startDate?: Date,
    endDate?: Date,
    limit = 10,
  ) {
    const where = this.baseWhere(tenantId, branchId, startDate, endDate);

    return prisma.itemProduct.groupBy({
      by: ["productId"],
      where,
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: limit,
    });
  }

  async getTopClients(
    tenantId: string,
    branchId?: string,
    startDate?: Date,
    endDate?: Date,
    limit = 10,
  ) {
    const where = this.baseWhere(tenantId, branchId, startDate, endDate);

    return prisma.sale.groupBy({
      by: ["clientId"],
      where,
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: "desc" } },
      take: limit,
    });
  }

  async getOverdueInstallments(tenantId: string, branchId?: string) {
    return prisma.paymentInstallment.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        paidAt: null,
        dueDate: { lt: new Date() },
        isActive: true,
      },
      include: {
        paymentMethodItem: {
          include: {
            payment: {
              include: {
                sale: {
                  include: { client: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });
  }
}
