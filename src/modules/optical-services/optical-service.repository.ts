// src/modules/optical-services/optical-service.repository.ts
import { prisma } from "../../config/prisma";
import { withAuditData } from "../../config/prisma-context";

type OpticalServiceCreateData = {
  name: string;
  description?: string;
  price: number;
  isActive?: boolean;
  branchId: string;
};

type OpticalServiceUpdateData = {
  name?: string;
  description?: string;
  price?: number;
  isActive?: boolean;
};

const serviceIncludes = {
  branch: { select: { id: true, name: true } },
};

export class OpticalServiceRepository {
  async create(
    tenantId: string,
    data: OpticalServiceCreateData,
    userId?: string,
  ) {
    return prisma.opticalService.create({
      data: withAuditData(userId, { ...data, tenantId }),
      include: serviceIncludes,
    });
  }

  async update(id: number, data: OpticalServiceUpdateData, userId?: string) {
    return prisma.opticalService.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: serviceIncludes,
    });
  }

  // Busca apenas ativos — usado em validações de negócio e listagens
  async findById(id: number, tenantId: string) {
    return prisma.opticalService.findFirst({
      where: { id, tenantId, isActive: true },
      include: serviceIncludes,
    });
  }

  // Busca ignorando isActive — usado em relacionamentos históricos (ex: detalhes de venda)
  async findByIdRaw(id: number, tenantId: string) {
    return prisma.opticalService.findFirst({
      where: { id, tenantId },
      include: serviceIncludes,
    });
  }

  async findByNameInTenant(tenantId: string, name: string) {
    return prisma.opticalService.findFirst({
      where: { tenantId, name, isActive: true },
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
      isActive: true,
      ...(search ? { name: { contains: search } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.opticalService.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: serviceIncludes,
      }),
      prisma.opticalService.count({ where }),
    ]);

    return { items, total };
  }

  async hasItemOpticalServices(id: number) {
    const count = await prisma.itemOpticalService.count({
      where: { serviceId: id },
    });
    return count > 0;
  }

  async hardDelete(id: number) {
    return prisma.opticalService.delete({ where: { id } });
  }

  async softDelete(id: number, userId?: string) {
    return prisma.opticalService.update({
      where: { id },
      data: withAuditData(userId, { isActive: false }, true),
    });
  }
}
