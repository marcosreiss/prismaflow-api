// src/modules/prescriptions/prescription.repository.ts
import {
  formatDateOnlyFieldsForModel,
  prisma,
  withAuditData,
} from "../../config/prisma-context";
import { Prisma } from "@prisma/client";
import logger from "../../utils/logger";

type PrescriptionCreateData = {
  clientId: number;
  prescriptionDate?: Date;
  doctorName?: string;
  crm?: string;
  odSphericalFar?: string;
  odCylindricalFar?: string;
  odAxisFar?: string;
  odDnpFar?: string;
  odSphericalNear?: string;
  odCylindricalNear?: string;
  odAxisNear?: string;
  odDnpNear?: string;
  oeSphericalFar?: string;
  oeCylindricalFar?: string;
  oeAxisFar?: string;
  oeDnpFar?: string;
  oeSphericalNear?: string;
  oeCylindricalNear?: string;
  oeAxisNear?: string;
  oeDnpNear?: string;
  odPellicleFar?: string;
  odPellicleNear?: string;
  oePellicleFar?: string;
  oePellicleNear?: string;
  frameAndRef?: string;
  lensType?: string;
  notes?: string;
  additionRight?: string;
  additionLeft?: string;
  opticalCenterRight?: string;
  opticalCenterLeft?: string;
  isActive?: boolean;
  branchId: string;
};

type PrescriptionUpdateData = Partial<
  Omit<PrescriptionCreateData, "clientId" | "branchId">
>;

const prescriptionIncludes = {
  client: { select: { id: true, name: true } },
};

export class PrescriptionRepository {
  async create(
    tenantId: string,
    data: PrescriptionCreateData,
    userId?: string,
  ) {
    return prisma.prescription.create({
      data: withAuditData(userId, { ...data, tenantId }),
      include: prescriptionIncludes,
    });
  }

  async update(
    prescriptionId: number,
    data: PrescriptionUpdateData,
    userId?: string,
  ) {
    return prisma.prescription.update({
      where: { id: prescriptionId },
      data: withAuditData(userId, data, true),
      include: prescriptionIncludes,
    });
  }

  async findById(prescriptionId: number, tenantId: string) {
    return prisma.prescription.findFirst({
      where: { id: prescriptionId, tenantId, isActive: true },
      include: prescriptionIncludes,
    });
  }

  async findByIdRaw(prescriptionId: number, tenantId: string) {
    return prisma.prescription.findFirst({
      where: { id: prescriptionId, tenantId },
      include: prescriptionIncludes,
    });
  }

  async findAllByTenant(
    tenantId: string,
    page: number,
    limit: number,
    clientId?: number,
    branchId?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.PrescriptionWhereInput = {
      tenantId,
      isActive: true,
      ...(clientId && { clientId }),
      ...(branchId && { branchId }),
    };

    const [items, total] = await Promise.all([
      prisma.prescription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { prescriptionDate: "desc" },
        include: prescriptionIncludes,
      }),
      prisma.prescription.count({ where }),
    ]);

    return { items, total };
  }

  async findByClientId(
    tenantId: string,
    clientId: number,
    page: number,
    limit: number,
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.PrescriptionWhereInput = {
      tenantId,
      clientId,
      isActive: true,
    };

    const [items, total] = await Promise.all([
      prisma.prescription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { prescriptionDate: "desc" },
        include: prescriptionIncludes,
      }),
      prisma.prescription.count({ where }),
    ]);

    return { items, total };
  }

  async findExpiringPrescriptions(
    tenantId: string,
    page: number,
    limit: number,
    targetDate?: string,
    branchId?: string,
  ) {
    logger.debug("🟦 [PrescriptionRepository] Buscando receitas vencidas", {
      tenantId,
      branchId,
      page,
      limit,
      targetDate,
    });

    try {
      const skip = (page - 1) * limit;

      const referenceDate = targetDate
        ? new Date(targetDate)
        : new Date(
            new Date().toLocaleString("en-US", {
              timeZone: "America/Sao_Paulo",
            }),
          );

      const expirationLimit = new Date(referenceDate);
      expirationLimit.setFullYear(expirationLimit.getFullYear() - 1);
      const formattedDate = expirationLimit.toISOString().split("T")[0];

      const branchFilter = branchId
        ? Prisma.sql`AND p.branchId = ${branchId}`
        : Prisma.empty;

      const totalRows = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
        SELECT COUNT(*) AS total
        FROM Prescription p
        WHERE p.tenantId = ${tenantId}
          ${branchFilter}
          AND p.isActive = 1
          AND DATE(p.prescriptionDate) = ${formattedDate}
      `);

      const total = totalRows?.[0] ? Number(totalRows[0].total) : 0;
      if (total === 0) return { items: [], total: 0, page, limit };

      const items = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT
          p.*,
          c.id AS clientId,
          c.name AS clientName,
          c.phone01
        FROM Prescription p
        INNER JOIN Client c ON c.id = p.clientId
        WHERE p.tenantId = ${tenantId}
          ${branchFilter}
          AND p.isActive = 1
          AND DATE(p.prescriptionDate) = ${formattedDate}
        ORDER BY c.name ASC
        LIMIT ${limit} OFFSET ${skip}
      `);

      return {
        items: formatDateOnlyFieldsForModel("Prescription", items),
        total,
        page,
        limit,
      };
    } catch (error: any) {
      logger.error(
        "❌ [PrescriptionRepository] Erro ao buscar receitas vencidas",
        {
          message: error?.message,
          stack: error?.stack,
        },
      );
      throw error;
    }
  }

  async hasSales(prescriptionId: number) {
    const count = await prisma.sale.count({ where: { prescriptionId } });
    return count > 0;
  }

  async softDelete(prescriptionId: number, userId?: string) {
    return prisma.prescription.update({
      where: { id: prescriptionId },
      data: withAuditData(userId, { isActive: false }, true),
    });
  }

  async hardDelete(prescriptionId: number) {
    return prisma.prescription.delete({ where: { id: prescriptionId } });
  }
}
