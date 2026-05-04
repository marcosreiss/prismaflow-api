// src/modules/clients/client.repository.ts
import { Prisma, Gender } from "@prisma/client";
import {
  formatDateOnlyFieldsForModel,
  prisma,
  withAuditData,
} from "../../config/prisma-context";
import logger from "../../utils/logger";

type ClientCreateData = {
  name: string;
  nickname?: string;
  cpf?: string;
  rg?: string;
  bornDate?: Date;
  gender?: Gender;
  fatherName?: string;
  motherName?: string;
  spouse?: string;
  email?: string;
  company?: string;
  occupation?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  uf?: string;
  cep?: string;
  complement?: string;
  isBlacklisted?: boolean;
  obs?: string;
  phone01?: string;
  phone02?: string;
  phone03?: string;
  reference01?: string;
  reference02?: string;
  reference03?: string;
  isActive?: boolean;
};

type ClientUpdateData = Partial<ClientCreateData>;

export class ClientRepository {
  async create(
    tenantId: string,
    branchId: string,
    data: ClientCreateData,
    userId?: string,
  ) {
    return prisma.client.create({
      data: withAuditData(userId, { ...data, tenantId, branchId }),
    });
  }

  async update(clientId: number, data: ClientUpdateData, userId?: string) {
    return prisma.client.update({
      where: { id: clientId },
      data: withAuditData(userId, data, true),
    });
  }

  async findById(clientId: number, tenantId: string) {
    return prisma.client.findFirst({
      where: { id: clientId, tenantId, isActive: true },
      include: {
        prescriptions: {
          where: { isActive: true },
          orderBy: { prescriptionDate: "desc" },
        },
      },
    });
  }

  // Busca ignorando isActive — para relacionamentos históricos
  async findByIdRaw(clientId: number, tenantId: string) {
    return prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
  }

  async findAllByTenant(
    tenantId: string,
    page: number,
    limit: number,
    search?: string,
    branchId?: string, // opcional: ADMIN/MANAGER podem filtrar por filial
  ) {
    const skip = (page - 1) * limit;
    const where = {
      tenantId,
      isActive: true,
      ...(branchId ? { branchId } : {}),
      ...(search ? { name: { contains: search } } : {}),
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

  async findByNameForSelect(
    tenantId: string,
    name: string,
    branchId?: string, // opcional: EMPLOYEE passa branchId, ADMIN/MANAGER não
  ) {
    return prisma.client.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(branchId ? { branchId } : {}),
        name: { contains: name },
      },
      select: { id: true, name: true },
      take: 50,
      orderBy: { name: "asc" },
    });
  }

  async findBirthdays(
    tenantId: string,
    page: number,
    limit: number,
    targetDate?: string,
    branchId?: string,
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

      let day: number;
      let month: number;

      if (targetDate) {
        const [, monthStr, dayStr] = targetDate.split("-");
        day = parseInt(dayStr, 10);
        month = parseInt(monthStr, 10);
      } else {
        const localStr = new Date().toLocaleDateString("en-CA", {
          timeZone: "America/Sao_Paulo",
        });
        const [, mStr, dStr] = localStr.split("-");
        day = parseInt(dStr, 10);
        month = parseInt(mStr, 10);
      }

      const branchFilter = branchId
        ? Prisma.sql`AND branchId = ${branchId}`
        : Prisma.empty;

      const totalRows = await prisma.$queryRaw<{ total: bigint }[]>(
        Prisma.sql`
          SELECT COUNT(*) AS total
          FROM Client
          WHERE tenantId = ${tenantId}
            ${branchFilter}
            AND isActive = 1
            AND bornDate IS NOT NULL
            AND DAY(bornDate) = ${day}
            AND MONTH(bornDate) = ${month}
        `,
      );

      const total =
        Array.isArray(totalRows) && totalRows[0]
          ? Number(totalRows[0].total)
          : 0;

      if (total === 0) return { items: [], total: 0, page, limit };

      const items = await prisma.$queryRaw<any[]>(
        Prisma.sql`
          SELECT
            id, name, nickname, email, phone01, phone02, phone03,
            bornDate, isActive, tenantId, branchId, createdAt, updatedAt
          FROM Client
          WHERE tenantId = ${tenantId}
            ${branchFilter}
            AND isActive = 1
            AND bornDate IS NOT NULL
            AND DAY(bornDate) = ${day}
            AND MONTH(bornDate) = ${month}
          ORDER BY name ASC
          LIMIT ${limit} OFFSET ${skip}
        `,
      );

      return {
        items: formatDateOnlyFieldsForModel("Client", items),
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

  async findByCpf(cpf: string, tenantId: string) {
    return prisma.client.findUnique({
      where: { cpf_tenantId: { cpf, tenantId } },
    });
  }

  async hasRelations(clientId: number) {
    const [sales, prescriptions] = await Promise.all([
      prisma.sale.count({ where: { clientId } }),
      prisma.prescription.count({ where: { clientId } }),
    ]);
    return sales > 0 || prescriptions > 0;
  }

  async softDelete(clientId: number, userId?: string) {
    return prisma.client.update({
      where: { id: clientId },
      data: withAuditData(userId, { isActive: false }, true),
    });
  }

  async hardDelete(clientId: number) {
    return prisma.client.delete({ where: { id: clientId } });
  }
}
