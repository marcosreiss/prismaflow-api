import { prisma, withAuditData } from "../../config/prisma-context";

export class BrandRepository {
  async create(tenantId: string, data: any, userId?: string) {
    return prisma.brand.create({
      data: withAuditData(userId, { ...data, tenantId }),
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  async update(id: number, data: any, userId?: string) {
    return prisma.brand.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  async findById(id: number) {
    return prisma.brand.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  async findByNameInTenant(tenantId: string, name: string) {
    return prisma.brand.findFirst({
      where: { tenantId, name },
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
      prisma.brand.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
        },
      }),
      prisma.brand.count({ where: whereClause }),
    ]);

    return { items, total };
  }

  async delete(id: number) {
    return prisma.brand.delete({ where: { id } });
  }
}
