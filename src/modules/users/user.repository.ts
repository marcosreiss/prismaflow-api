import { prisma } from "../../config/prisma";
import { Role } from "@prisma/client";

export class UserRepository {
  create(params: {
    name: string;
    email: string;
    password: string;
    role: Role;
    tenantId: string;
    branchId?: string | null;
  }) {
    return prisma.user.create({ data: params });
  }

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findAllByTenant(tenantId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId },
        skip,
        take: limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          branch: { select: { id: true, name: true } },
        },
      }),
      prisma.user.count({ where: { tenantId } }),
    ]);

    return { items, total };
  }

  async findEmployeesByBranch(
    tenantId: string,
    branchId: string,
    page: number,
    limit: number
  ) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId, branchId, role: "EMPLOYEE" },
        skip,
        take: limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          branch: { select: { id: true, name: true } },
        },
      }),
      prisma.user.count({ where: { tenantId, branchId, role: "EMPLOYEE" } }),
    ]);

    return { items, total };
  }
}
