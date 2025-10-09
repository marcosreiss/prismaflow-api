import { prisma, withAuditData } from "../../config/prisma-context";

export class ClientRepository {
  async create(tenantId: string, branchId: string, data: any, userId?: string) {
    // 🔹 Remove qualquer campo duplicado vindo do DTO
    const { tenant, branch, ...safeData } = data;

    return prisma.client.create({
      data: withAuditData(userId, {
        ...safeData,
        tenantId, // ✅ usa os IDs diretos
        branchId, // ✅ idem
      }),
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  async update(clientId: number, data: any, userId?: string) {
    return prisma.client.update({
      where: { id: clientId },
      data: withAuditData(userId, data, true),
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  async findById(clientId: number, tenantId: string) {
    return prisma.client.findFirst({
      where: { id: clientId, tenantId },
      include: {
        prescriptions: true,
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  async findByNameInTenant(tenantId: string, name: string) {
    return prisma.client.findFirst({
      where: {
        tenantId,
        name: { contains: name },
      },
    });
  }

  async findAllByTenant(
    tenantId: string,
    page: number,
    limit: number,
    search?: string
  ) {
    const skip = (page - 1) * limit;
    const where = {
      tenantId,
      ...(search && {
        name: { contains: search },
      }),
    };

    const [items, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return { items, total };
  }

  async findAllByTenantAndBranch(
    tenantId: string,
    branchId?: string,
    page = 1,
    limit = 10,
    search?: string
  ) {
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (branchId) where.branchId = branchId;
    if (search) where.name = { contains: search };

    const [items, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.client.count({ where }),
    ]);

    return { items, total };
  }

  async findByNameForSelect(tenantId: string, branchId: string, name: string) {
    return prisma.client.findMany({
      where: {
        tenantId,
        branchId,
        name: { contains: name },
      },
      select: { id: true, name: true },
      take: 50,
      orderBy: { name: "asc" },
    });
  }
}
