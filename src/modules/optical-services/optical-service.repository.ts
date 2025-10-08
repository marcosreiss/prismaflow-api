import { prisma, withAuditData } from "../../config/prisma-context";

export class OpticalServiceRepository {
  async create(tenantId: string, data: any, userId?: string) {
    return prisma.opticalService.create({
      data: withAuditData(userId, {
        ...data,
        tenantId,
      }),
      include: {
        branch: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  async update(id: number, data: any, userId?: string) {
    return prisma.opticalService.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: {
        branch: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  async findById(id: number) {
    return prisma.opticalService.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  async findByNameInTenant(tenantId: string, name: string) {
    return prisma.opticalService.findFirst({
      where: {
        tenantId,
        name: {
          equals: name,
        },
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

    const whereClause: any = {
      tenantId,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.opticalService.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          branch: { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
        },
      }),
      prisma.opticalService.count({ where: whereClause }),
    ]);

    return { items, total };
  }

  async delete(id: number) {
    return prisma.opticalService.delete({ where: { id } });
  }
}
