import { prisma, withAuditData } from "../../config/prisma-context";
import { ProductCategory } from "@prisma/client";

export class ProductRepository {
  async create(tenantId: string, data: any, userId?: string) {
    return prisma.product.create({
      data: withAuditData(userId, { ...data, tenantId }),
      include: {
        brand: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  async update(id: number, data: any, userId?: string) {
    return prisma.product.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: {
        brand: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  async findById(id: number) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  async findByNameInTenant(tenantId: string, name: string) {
    return prisma.product.findFirst({
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
    search?: string,
    category?: ProductCategory
  ) {
    const skip = (page - 1) * limit;

    const whereClause: any = {
      tenantId,
      ...(search ? { name: { contains: search } } : {}),
      ...(category ? { category } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          brand: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
        },
      }),
      prisma.product.count({ where: whereClause }),
    ]);

    return { items, total };
  }

  async delete(id: number) {
    return prisma.product.delete({ where: { id } });
  }
}
