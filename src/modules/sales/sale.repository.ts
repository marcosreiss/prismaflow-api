import { prisma, withAuditData } from "../../config/prisma-context";

export class SaleRepository {
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
      },
    });
  }

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
      },
    });
  }

  async createProtocol(data: any, userId?: string) {
    return prisma.protocol.create({
      data: withAuditData(userId, data),
    });
  }

  async updateProtocol(id: number, data: any, userId?: string) {
    return prisma.protocol.update({
      where: { id },
      data: withAuditData(userId, data, true),
    });
  }

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
        },
      }),
      prisma.sale.count({ where }),
    ]);

    return { items, total };
  }

  async findByClientId(clientId: number, tenantId: string) {
    return prisma.sale.findMany({
      where: { tenantId, clientId },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        protocol: true,
      },
    });
  }

  async findProtocolBySale(saleId: number) {
    return prisma.protocol.findFirst({
      where: { saleId },
    });
  }

  async findProductItemsBySale(saleId: number) {
    return prisma.itemProduct.findMany({
      where: { saleId },
      include: {
        product: { select: { id: true, name: true, stockQuantity: true } },
        frameDetails: true,
      },
    });
  }

  async findFrameDetailsByItemProduct(itemProductId: number) {
    return prisma.frameDetails.findFirst({
      where: { itemProductId },
    });
  }

  async findOpticalServiceItemsBySale(saleId: number) {
    return prisma.itemOpticalService.findMany({
      where: { saleId },
      include: {
        service: { select: { id: true, name: true } },
      },
    });
  }

  async softDelete(id: number, userId?: string) {
    return prisma.sale.update({
      where: { id },
      data: withAuditData(userId, { isActive: false }, true),
    });
  }
}
