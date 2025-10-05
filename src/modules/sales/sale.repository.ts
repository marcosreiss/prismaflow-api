import { prisma, withAuditData } from "../../config/prisma-context";

export class SaleRepository {
  // 🔹 Criação de venda completa (com protocolo e itens)
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

  // 🔹 Buscar venda por ID
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

  // 🔹 Listagem paginada (com filtro opcional por clientId)
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

  // 🔹 Busca vendas por clientId (atalho)
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

  // 🔹 Buscar itens de produto por saleId
  async findProductItemsBySale(saleId: number) {
    return prisma.itemProduct.findMany({
      where: { saleId },
      include: {
        product: { select: { id: true, name: true } },
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

  // 🔹 Remover venda (soft delete)
  async softDelete(id: number, userId?: string) {
    return prisma.sale.update({
      where: { id },
      data: withAuditData(userId, { isActive: false }, true),
    });
  }
}
