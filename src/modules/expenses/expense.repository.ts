import { prisma, withAuditData } from "../../config/prisma-context";

export class ExpenseRepository {
  async create(tenantId: string, branchId: string, data: any, userId?: string) {
    return prisma.expense.create({
      data: withAuditData(userId, {
        ...data,
        tenantId,
        branchId,
      }),
    });
  }

  async update(id: number, data: any, userId?: string) {
    return prisma.expense.update({
      where: { id },
      data: withAuditData(userId, data, true),
    });
  }

  async findById(id: number, tenantId: string) {
    return prisma.expense.findFirst({
      where: { id, tenantId },
    });
  }

  async findAllByTenant(
    tenantId: string,
    page: number,
    limit: number,
    branchId?: string,
    status?: string,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(branchId && { branchId }),
      ...(status && { status }),
      ...(search && { description: { contains: search } }),
    };

    const [items, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: "asc" },
      }),
      prisma.expense.count({ where }),
    ]);

    return { items, total };
  }

  async delete(id: number) {
    return prisma.expense.delete({
      where: { id },
    });
  }
}
