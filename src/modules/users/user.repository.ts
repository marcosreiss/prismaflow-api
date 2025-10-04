import { prisma } from "../../config/prisma";
import { Role } from "@prisma/client";
import { withAuditData } from "../../config/prisma-context";

export class UserRepository {
  create(params: {
    name: string;
    email: string;
    password: string;
    role: Role;
    tenantId: string;
    branchId?: string | null;
    userId?: string;
  }) {
    const { userId, ...data } = params;
    return prisma.user.create({
      data: withAuditData(userId, data),
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  update(id: string, data: any, userId?: string) {
    return prisma.user.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  async findAllByTenant(tenantId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId },
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          branch: { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
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
        include: {
          branch: { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
        },
      }),
      prisma.user.count({ where: { tenantId, branchId, role: "EMPLOYEE" } }),
    ]);

    return { items, total };
  }
}
