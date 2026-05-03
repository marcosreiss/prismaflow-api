// src/modules/brands/brand.repository.ts
import { prisma } from "../../config/prisma";
import { withAuditData } from "../../config/prisma-context";

type BrandCreateData = { name: string; isActive?: boolean };
type BrandUpdateData = { name?: string; isActive?: boolean };

export class BrandRepository {
  async create(tenantId: string, data: BrandCreateData, userId?: string) {
    return prisma.brand.create({
      data: withAuditData(userId, { ...data, tenantId }),
    });
  }

  async update(id: number, data: BrandUpdateData, userId?: string) {
    return prisma.brand.update({
      where: { id },
      data: withAuditData(userId, data, true),
    });
  }

  // Sempre filtra por tenantId para garantir isolamento multi-tenant
  async findById(id: number, tenantId: string) {
    return prisma.brand.findFirst({
      where: { id, tenantId },
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
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const where = {
      tenantId,
      ...(search ? { name: { contains: search } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.brand.count({ where }),
    ]);

    return { items, total };
  }

  async hasProducts(id: number) {
    const count = await prisma.product.count({ where: { brandId: id } });
    return count > 0;
  }

  async delete(id: number) {
    return prisma.brand.delete({ where: { id } });
  }
}
