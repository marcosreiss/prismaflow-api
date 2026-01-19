import { Prisma } from "@prisma/client";
import { prisma, withAuditData } from "../../config/prisma-context";
import logger from "../../utils/logger";

export class ClientRepository {
  async create(tenantId: string, branchId: string, data: any, userId?: string) {
    const { tenant, branch, ...safeData } = data;

    return prisma.client.create({
      data: withAuditData(userId, {
        ...safeData,
        tenantId,
        branchId,
      }),
    });
  }

  async update(clientId: number, data: any, userId?: string) {
    return prisma.client.update({
      where: { id: clientId },
      data: withAuditData(userId, data, true),
    });
  }

  async findById(clientId: number, tenantId: string) {
    return prisma.client.findFirst({
      where: { id: clientId, tenantId },
      include: {
        prescriptions: true,
      },
    });
  }

  async findByNameInTenant(tenantId: string, name: string) {
    return prisma.client.findFirst({
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
    search?: string
  ) {
    const skip = (page - 1) * limit;
    const where = {
      tenantId,
      ...(search && {
        name: { contains: search },
      }),
    };

    const [items, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.client.count({ where }),
    ]);

    return { items, total };
  }

  async findAllByTenantAndBranch(
    tenantId: string,
    branchId?: string,
    page = 1,
    limit = 10,
    search?: string
  ) {
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (branchId) where.branchId = branchId;
    if (search) where.name = { contains: search };

    const [items, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.client.count({ where }),
    ]);

    return { items, total };
  }

  async findByNameForSelect(tenantId: string, branchId: string, name: string) {
    return prisma.client.findMany({
      where: {
        tenantId,
        branchId,
        name: { contains: name },
      },
      select: { id: true, name: true },
      take: 50,
      orderBy: { name: "asc" },
    });
  }

  async findBirthdays(
    tenantId: string,
    branchId?: string,
    page = 1,
    limit = 10,
    targetDate?: string // ← nova data opcional (ISO)
  ) {
    logger.debug("🟦 [ClientRepository] Iniciando busca de aniversariantes", {
      tenantId,
      branchId,
      page,
      limit,
      targetDate,
    });

    try {
      const skip = (page - 1) * limit;

      // 📅 Define data-base: se vier na request, usa ela; senão, pega data atual do Brasil
      let referenceDate: Date;
      if (targetDate) {
        referenceDate = new Date(targetDate);
      } else {
        const nowUtc = new Date();
        referenceDate = new Date(
          nowUtc.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
        );
      }

      const day = referenceDate.getDate() + 1;
      const month = referenceDate.getMonth() + 1;

      logger.debug("🕐 [ClientRepository] Datas de referência", {
        targetDate,
        referenceDate: referenceDate.toISOString(),
        day,
        month,
      });

      const branchFilter = branchId
        ? Prisma.sql`AND branchId = ${branchId}`
        : Prisma.empty;

      // 📊 COUNT total
      const totalRows = await prisma.$queryRaw<{ total: bigint }[]>(
        Prisma.sql`
        SELECT COUNT(*) AS total
        FROM Client
        WHERE tenantId = ${tenantId}
          ${branchFilter}
          AND bornDate IS NOT NULL
          AND DAY(bornDate) = ${day}
          AND MONTH(bornDate) = ${month}
      `
      );

      const total =
        Array.isArray(totalRows) && totalRows[0]
          ? Number(totalRows[0].total)
          : 0;

      if (total === 0) {
        return { items: [], total: 0, page, limit };
      }

      const items = await prisma.$queryRaw<any[]>(
        Prisma.sql`
        SELECT 
          id, name, nickname, email, phone01, phone02, phone03,
          bornDate, isActive, tenantId, branchId, createdAt, updatedAt
        FROM Client
        WHERE tenantId = ${tenantId}
          ${branchFilter}
          AND bornDate IS NOT NULL
          AND DAY(bornDate) = ${day}
          AND MONTH(bornDate) = ${month}
        ORDER BY name ASC
        LIMIT ${limit} OFFSET ${skip}
      `
      );

      return { items, total, page, limit };
    } catch (error: any) {
      logger.error("❌ [ClientRepository] Erro ao buscar aniversariantes", {
        message: error?.message,
        stack: error?.stack,
      });
      throw error;
    }
  }

  async findByCpf(cpf: string, tenantId: string) {
  return prisma.client.findUnique({
    where: {
      cpf_tenantId: {
        cpf,
        tenantId,
      },
    },
  });
}

}
