import { prisma, withAuditData } from "../../config/prisma-context";
import { Prisma } from "@prisma/client";
import logger from "../../utils/logger";

export class PrescriptionRepository {
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
      },
    });
  }

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
      },
    });
  }

  async findById(prescriptionId: number, tenantId: string) {
    return prisma.prescription.findFirst({
      where: { id: prescriptionId, tenantId },
      include: {
        client: { select: { id: true, name: true } },
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
        },
      }),
      prisma.prescription.count({ where }),
    ]);

    return { items, total };
  }

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
        },
      }),
      prisma.prescription.count({ where }),
    ]);

    return { items, total };
  }

  async findExpiringPrescriptions(
    tenantId: string,
    branchId?: string,
    page = 1,
    limit = 10,
    targetDate?: string // ← opcional (ISO)
  ) {
    logger.debug("\n \n \n \n🟦 [PrescriptionRepository] Buscando receitas vencidas", {
      tenantId,
      branchId,
      page,
      limit,
      targetDate,
    });

    try {
      const skip = (page - 1) * limit;

      // 📅 Define a data-base: atual (Brasil) ou informada
      let referenceDate: Date;
      if (targetDate) {
        referenceDate = new Date(targetDate);
      } else {
        const nowUtc = new Date();
        referenceDate = new Date(
          nowUtc.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
        );
      }

      // 🔢 Data limite: exatamente 1 ano antes
      const expirationLimit = new Date(referenceDate);
      expirationLimit.setFullYear(expirationLimit.getFullYear() - 1);

      // 🧭 Formata YYYY-MM-DD com padding
      const year = expirationLimit.getFullYear();
      const month = String(expirationLimit.getMonth() + 1).padStart(2, "0");
      const day = String(expirationLimit.getDate()).padStart(2, "0");
      const formattedDate = `${year}-${month}-${day}`;

      logger.debug("🕐 [PrescriptionRepository] Data referência calculada", {
        referenceDate: referenceDate.toISOString(),
        expirationLimit: expirationLimit.toISOString(),
        formattedDate,
      });

      // 🔢 Filtro opcional de filial
      const branchFilter = branchId
        ? Prisma.sql`AND p.branchId = ${branchId}`
        : Prisma.empty;

      // 🧮 Consulta COUNT total
      const totalRows = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT COUNT(*) AS total
      FROM Prescription p
      WHERE p.tenantId = ${tenantId}
        ${branchFilter}
        AND p.isActive = true
        AND DATE(CONVERT_TZ(p.prescriptionDate, '+00:00', '-03:00')) = ${formattedDate}
    `);

      const total =
        Array.isArray(totalRows) && totalRows[0]
          ? Number(totalRows[0].total)
          : 0;

      if (total === 0) {
        logger.debug("⚪ Nenhuma receita encontrada para a data", {
          formattedDate,
        });
        return { items: [], total: 0, page, limit };
      }

      // 📋 Lista paginada
      const items = await prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT 
        c.id AS clientId,
        c.name AS clientName,
        c.phone01,
        p.id AS prescriptionId,
        p.prescriptionDate,
        p.doctorName,
        p.crm
      FROM Prescription p
      INNER JOIN Client c ON c.id = p.clientId
      WHERE p.tenantId = ${tenantId}
        ${branchFilter}
        AND p.isActive = true
        AND DATE(CONVERT_TZ(p.prescriptionDate, '+00:00', '-03:00')) = ${formattedDate}
      ORDER BY c.name ASC
      LIMIT ${limit} OFFSET ${skip}
    `);

      logger.debug("✅ [PrescriptionRepository] Consulta concluída", {
        total,
        returned: items.length,
        formattedDate,
      });

      return { items, total, page, limit };
    } catch (error: any) {
      logger.error(
        "❌ [PrescriptionRepository] Erro ao buscar receitas vencidas",
        {
          message: error?.message,
          stack: error?.stack,
        }
      );
      throw error;
    }
  }
}
