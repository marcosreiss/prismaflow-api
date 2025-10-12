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
    limit = 10
  ) {
    logger.debug("🟦 [ClientRepository] Iniciando busca de aniversariantes", {
      tenantId,
      branchId,
      page,
      limit,
    });

    try {
      const skip = (page - 1) * limit;

      // 📅 Data atual no fuso do Brasil (para calcular dia/mês)
      const nowUtc = new Date();
      const brazilNow = new Date(
        nowUtc.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
      );
      const day = brazilNow.getDate() + 1;
      const month = brazilNow.getMonth() + 1;

      logger.debug("🕐 [ClientRepository] Datas de referência", {
        nowUtc: nowUtc.toISOString(),
        brazilNow: brazilNow.toISOString(),
        day,
        month,
      });

      // 🔢 Monta fragmentos SQL opcionais de forma segura
      const branchFilter = branchId
        ? Prisma.sql`AND branchId = ${branchId}`
        : Prisma.empty;

      // 📊 COUNT total (antes da paginação)
      logger.debug("🔎 [ClientRepository] Executando COUNT de aniversariantes", {
        day,
        month,
      });

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

      logger.debug("🧮 [ClientRepository] COUNT finalizado", { total });

      if (total === 0) {
        logger.info(
          "ℹ️ [ClientRepository] Nenhum aniversariante encontrado para hoje",
          {
            day,
            month,
            tenantId,
            branchId,
          }
        );
        return {
          items: [],
          total: 0,
          page,
          limit,
        };
      }

      // 📄 Lista paginada
      logger.debug(
        "📥 [ClientRepository] Buscando lista paginada de aniversariantes",
        {
          skip,
          limit,
        }
      );

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

      logger.debug("✅ [ClientRepository] Consulta concluída", {
        returned: items.length,
        page,
        limit,
        sample: items.slice(0, 3).map((c) => ({
          id: c.id,
          name: c.name,
          bornDate: c.bornDate,
        })),
      });

      // Observação útil para troubleshooting: se o total > 0 e items = 0, page/limit/skip podem estar fora do range
      if (items.length === 0 && total > 0) {
        logger.warn(
          "⚠️ [ClientRepository] Página solicitada não possui resultados",
          {
            page,
            limit,
            skip,
            total,
          }
        );
      }

      logger.info("📤 [ClientRepository] Retornando aniversariantes", {
        count: items.length,
        total,
        page,
        limit,
      });

      return {
        items,
        total,
        page,
        limit,
      };
    } catch (error: any) {
      logger.error("❌ [ClientRepository] Erro ao buscar aniversariantes", {
        message: error?.message,
        stack: error?.stack,
      });
      throw error;
    }
  }
}
