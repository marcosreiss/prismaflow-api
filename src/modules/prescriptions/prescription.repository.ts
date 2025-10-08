import { prisma, withAuditData } from "../../config/prisma-context";
import { Prisma } from "@prisma/client";

export class PrescriptionRepository {
  // =========================================================
  // 🔹 CREATE
  // =========================================================
  async create(
    tenantId: string,
    data: Prisma.PrescriptionUncheckedCreateInput,
    userId?: string
  ) {
    if (!data.branchId) {
      throw new Error("branchId é obrigatório para criar a prescrição.");
    }

    if (data.prescriptionDate) {
      data.prescriptionDate = new Date(data.prescriptionDate).toISOString();
    }

    return prisma.prescription.create({
      data: withAuditData(userId, {
        ...data,
        tenantId,
      }) as Prisma.PrescriptionUncheckedCreateInput,
      include: {
        client: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  // =========================================================
  // 🔹 UPDATE
  // =========================================================
  async update(
    prescriptionId: number,
    data: Prisma.PrescriptionUpdateInput,
    userId?: string
  ) {
    return prisma.prescription.update({
      where: { id: prescriptionId },
      data: withAuditData(userId, data, true),
      include: {
        client: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  // =========================================================
  // 🔹 FIND BY ID
  // =========================================================
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

  // =========================================================
  // 🔹 FIND ALL BY TENANT
  // =========================================================
  async findAllByTenant(
    tenantId: string,
    page: number,
    limit: number,
    clientId?: number
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.PrescriptionWhereInput = {
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

  // =========================================================
  // 🔹 FIND BY CLIENT ID
  // =========================================================
  async findByClientId(
    tenantId: string,
    clientId: number,
    page: number,
    limit: number
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.PrescriptionWhereInput = { tenantId, clientId };

    const [items, total] = await Promise.all([
      prisma.prescription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
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
