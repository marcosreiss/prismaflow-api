import { prisma, withAuditData } from "../../config/prisma-context";

export class PrescriptionRepository {
  async create(tenantId: string, data: any, userId?: string) {
    return prisma.prescription.create({
      data: withAuditData(userId, { ...data, tenantId }),
      include: {
        client: { select: { name: true, id: true } },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  async update(prescriptionId: number, data: any, userId?: string) {
    return prisma.prescription.update({
      where: { id: prescriptionId },
      data: withAuditData(userId, data, true),
      include: {
        client: { select: { name: true, id: true } },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  async findById(prescriptionId: number, tenantId: string) {
    return prisma.prescription.findFirst({
      where: { id: prescriptionId, tenantId },
      include: {
        client: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  async findAllByTenant(
    tenantId: string,
    page: number,
    limit: number,
    clientId?: number
  ) {
    const skip = (page - 1) * limit;
    const where = {
      tenantId,
      ...(clientId && { clientId }),
    };

    const [items, total] = await Promise.all([
      prisma.prescription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { prescriptionDate: "desc" },
        include: {
          client: { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
        },
      }),
      prisma.prescription.count({ where }),
    ]);

    return { items, total };
  }
}
