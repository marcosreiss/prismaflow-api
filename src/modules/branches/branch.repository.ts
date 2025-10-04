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
}
