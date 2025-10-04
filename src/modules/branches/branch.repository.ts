import { prisma } from "../../config/prisma";

export class BranchRepository {
  create(tenantId: string, name: string) {
    return prisma.branch.create({ data: { name, tenantId } });
  }

  findByNameInTenant(tenantId: string, name: string) {
    return prisma.branch.findFirst({ where: { tenantId, name } });
  }

  findByIdInTenant(tenantId: string, branchId: string) {
    return prisma.branch.findFirst({ where: { id: branchId, tenantId } });
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
}
