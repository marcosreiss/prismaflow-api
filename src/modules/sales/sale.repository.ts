import { prisma, withAuditData } from "../../config/prisma-context";

export class SaleRepository {
  async create(data: any, userId?: string) {
    console.log("🔍 Dados recebidos no SaleRepository.create:", {
      prescriptionId: data.prescriptionId,
      clientId: data.clientId,
      hasProductItems: !!data.productItems,
      hasServiceItems: !!data.serviceItems,
    });
    return prisma.sale.create({
      data: withAuditData(userId, data),
      include: {
        client: { select: { id: true, name: true } },
        protocol: true,
        prescription: data.prescriptionId,
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
      select: {
        // ✅ ADICIONE ESTES CAMPOS OBRIGATÓRIOS:
        id: true,
        clientId: true,
        prescriptionId: true,
        subtotal: true,
        discount: true,
        total: true,
        notes: true,
        isActive: true,
        tenantId: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,

        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone01: true,
          },
        },
        protocol: true,
        productItems: {
          select: {
            // ✅ ADICIONE ESTES CAMPOS CRÍTICOS:
            id: true,
            productId: true,
            quantity: true,
            saleId: true,

            product: {
              select: {
                id: true,
                name: true,
                salePrice: true,
                category: true,
                stockQuantity: true,
                brand: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            frameDetails: true,
          },
        },
        serviceItems: {
          select: {
            // ✅ ADICIONE ESTES CAMPOS CRÍTICOS:
            id: true,
            serviceId: true,
            saleId: true,

            service: {
              select: {
                id: true,
                name: true,
                price: true,
                description: true,
                isActive: true,
              },
            },
          },
        },
        prescription: {
          select: {
            id: true,
            clientId: true,
            prescriptionDate: true,
            doctorName: true,
            crm: true,
            odSpherical: true,
            odCylindrical: true,
            odAxis: true,
            odDnp: true,
            oeSpherical: true,
            oeCylindrical: true,
            oeAxis: true,
            oeDnp: true,
            additionRight: true,
            additionLeft: true,
            opticalCenterRight: true,
            opticalCenterLeft: true,
            isActive: true,
            tenantId: true,
            branchId: true,
            createdById: true,
            updatedById: true,
            createdAt: true,
            updatedAt: true,
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
