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
    targetDate?: string
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

      // 📅 Define data de referência
      const referenceDate = targetDate
        ? new Date(targetDate)
        : new Date(
            new Date().toLocaleString("en-US", {
              timeZone: "America/Sao_Paulo",
            })
          );

      // 📆 Um ano antes
      const expirationLimit = new Date(referenceDate);
      expirationLimit.setFullYear(expirationLimit.getFullYear() - 1);

      // 📅 Formata YYYY-MM-DD
      const formattedDate = expirationLimit.toISOString().split("T")[0];

      logger.debug("🕐 [PrescriptionRepository] Data referência calculada", {
        referenceDate: referenceDate.toISOString(),
        expirationLimit: expirationLimit.toISOString(),
        formattedDate,
      });

      const branchFilter = branchId
        ? Prisma.sql`AND p.branchId = ${branchId}`
        : Prisma.empty;

      // 🔢 COUNT total
      const totalRows = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT COUNT(*) AS total
      FROM Prescription p
      WHERE p.tenantId = ${tenantId}
        ${branchFilter}
        AND p.isActive = true
        AND DATE(p.prescriptionDate) = ${formattedDate}
    `);

      const total = totalRows?.[0] ? Number(totalRows[0].total) : 0;

      if (total === 0) {
        logger.debug("⚪ Nenhuma receita encontrada para a data", {
          formattedDate,
        });
        return { items: [], total: 0, page, limit };
      }

      // 🧾 Lista completa
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
        AND p.isActive = true
        AND DATE(p.prescriptionDate) = ${formattedDate}
      ORDER BY c.name ASC
      LIMIT ${limit} OFFSET ${skip}
    `);

      logger.debug("✅ [PrescriptionRepository] Consulta concluída", {
        formattedDate,
        total,
        returned: items.length,
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

  async delete(prescriptionId: number, tenantId: string, userId?: string) {
    try {
      const existing = await prisma.prescription.findFirst({
        where: { id: prescriptionId, tenantId },
      });

      if (!existing) {
        throw new Error(
          "Receita não encontrada ou não pertence ao tenant informado."
        );
      }

      await prisma.prescription.delete({
        where: { id: prescriptionId },
      });

      logger.info("🗑️ [PrescriptionRepository] Receita deletada com sucesso", {
        prescriptionId,
        tenantId,
        userId,
      });

      return { success: true, message: "Receita deletada com sucesso." };
    } catch (error: any) {
      logger.error("❌ [PrescriptionRepository] Erro ao deletar receita", {
        prescriptionId,
        tenantId,
        message: error?.message,
        stack: error?.stack,
      });
      throw error;
    }
  }
}
