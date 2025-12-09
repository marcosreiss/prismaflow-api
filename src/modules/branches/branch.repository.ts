import { prisma } from "../../config/prisma";
import { withAuditData } from "../../config/prisma-context";

export class BranchRepository {
  create(tenantId: string, name: string, userId?: string) {
    return prisma.branch.create({
      data: withAuditData(userId, { name, tenantId }),
    });
  }

  update(branchId: string, data: any, userId?: string) {
    return prisma.branch.update({
      where: { id: branchId },
      data: withAuditData(userId, data, true),
    });
  }

  findByNameInTenant(tenantId: string, name: string) {
    return prisma.branch.findFirst({
      where: { tenantId, name },
    });
  }

  findByIdInTenant(tenantId: string, branchId: string) {
    return prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });
  }

  async findAllByTenant(tenantId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.branch.findMany({
        where: { tenantId },
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.branch.count({ where: { tenantId } }),
    ]);

    return { items, total };
  }

  async findAllSelectByTenant(tenantId: string) {
    return prisma.branch.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });
  }
}
