// src/modules/sales/sale.repository.ts
import { prisma, withAuditData } from "../../config/prisma-context";

export class SaleRepository {
  // 🔹 Criação de venda (não cria protocolo aqui)
  async create(data: any, userId?: string) {
    return prisma.sale.create({
      data: withAuditData(userId, data),
      include: {
        client: { select: { id: true, name: true } },
        protocol: true,
        productItems: {
          include: {
            product: { select: { id: true, name: true } },
            frameDetails: true,
          },
        },
        serviceItems: {
          include: {
            service: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  // 🔹 Atualização de venda
  async update(id: number, data: any, userId?: string) {
    return prisma.sale.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: {
        client: { select: { id: true, name: true } },
        protocol: true,
        productItems: {
          include: {
            product: { select: { id: true, name: true } },
            frameDetails: true,
          },
        },
        serviceItems: {
          include: {
            service: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  // 🔹 Criar protocolo (1:1) — usar no Service
  async createProtocol(data: any, userId?: string) {
    return prisma.protocol.create({
      data: withAuditData(userId, data),
    });
  }

  // 🔹 Atualizar protocolo — usar no Service
  async updateProtocol(id: number, data: any, userId?: string) {
    return prisma.protocol.update({
      where: { id },
      data: withAuditData(userId, data, true),
    });
  }

  // 🔹 Buscar venda por ID (escopo tenant)
  async findById(id: number, tenantId: string) {
    return prisma.sale.findFirst({
      where: { id, tenantId },
      include: {
        client: { select: { id: true, name: true } },
        protocol: true,
        productItems: {
          include: {
            product: { select: { id: true, name: true } },
            frameDetails: true,
          },
        },
        serviceItems: {
          include: {
            service: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  // 🔹 Listagem paginada (opcional por clientId)
  async findAllByTenant(
    tenantId: string,
    page: number,
    limit: number,
    clientId?: number
  ) {
    const skip = (page - 1) * limit;
    const where = clientId ? { tenantId, clientId } : { tenantId };

    const [items, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { id: true, name: true } },
          protocol: true,
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
        },
      }),
      prisma.sale.count({ where }),
    ]);

    return { items, total };
  }

  // 🔹 Atalho: buscar por clientId
  async findByClientId(clientId: number, tenantId: string) {
    return prisma.sale.findMany({
      where: { tenantId, clientId },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        protocol: true,
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  // 🔹 Buscar protocolo por saleId
  async findProtocolBySale(saleId: number) {
    return prisma.protocol.findFirst({
      where: { saleId },
      include: { createdBy: { select: { name: true } } },
    });
  }

  // 🔹 Buscar itens de produto por saleId (inclui stockQuantity)
  async findProductItemsBySale(saleId: number) {
    return prisma.itemProduct.findMany({
      where: { saleId },
      include: {
        product: { select: { id: true, name: true, stockQuantity: true } },
        frameDetails: true,
      },
    });
  }

  // 🔹 Buscar detalhes de armação por itemProductId
  async findFrameDetailsByItemProduct(itemProductId: number) {
    return prisma.frameDetails.findFirst({
      where: { itemProductId },
      include: { createdBy: { select: { name: true } } },
    });
  }

  // 🔹 Buscar itens de serviço por saleId
  async findOpticalServiceItemsBySale(saleId: number) {
    return prisma.itemOpticalService.findMany({
      where: { saleId },
      include: {
        service: { select: { id: true, name: true } },
      },
    });
  }

  // 🔹 Remoção lógica da venda
  async softDelete(id: number, userId?: string) {
    return prisma.sale.update({
      where: { id },
      data: withAuditData(userId, { isActive: false }, true),
    });
  }
}
