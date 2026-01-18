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
        prescription: {
          select: {
            id: true,
            prescriptionDate: true,
            doctorName: true,
            crm: true,
            // Longe
            odSphericalFar: true,
            odCylindricalFar: true,
            odAxisFar: true,
            odDnpFar: true,
            oeSphericalFar: true,
            oeCylindricalFar: true,
            oeAxisFar: true,
            oeDnpFar: true,
            // Perto
            odSphericalNear: true,
            odCylindricalNear: true,
            odAxisNear: true,
            odDnpNear: true,
            oeSphericalNear: true,
            oeCylindricalNear: true,
            oeAxisNear: true,
            oeDnpNear: true,
            // Outros
            additionRight: true,
            additionLeft: true,
            opticalCenterRight: true,
            opticalCenterLeft: true,
            isActive: true,
          },
        },
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
        prescription: {
          select: {
            id: true,
            prescriptionDate: true,
            doctorName: true,
            crm: true,
            odSphericalFar: true,
            odCylindricalFar: true,
            odAxisFar: true,
            odDnpFar: true,
            oeSphericalFar: true,
            oeCylindricalFar: true,
            oeAxisFar: true,
            oeDnpFar: true,
            odSphericalNear: true,
            odCylindricalNear: true,
            odAxisNear: true,
            odDnpNear: true,
            oeSphericalNear: true,
            oeCylindricalNear: true,
            oeAxisNear: true,
            oeDnpNear: true,
            additionRight: true,
            additionLeft: true,
            opticalCenterRight: true,
            opticalCenterLeft: true,
            isActive: true,
          },
        },
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
        id: true,
        clientId: true,
        saleDate: true,
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
                brand: { select: { id: true, name: true } },
              },
            },
            frameDetails: true,
          },
        },
        serviceItems: {
          select: {
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

            // 🔹 Grau de longe (renomeados)
            odSphericalFar: true,
            odCylindricalFar: true,
            odAxisFar: true,
            odDnpFar: true,
            oeSphericalFar: true,
            oeCylindricalFar: true,
            oeAxisFar: true,
            oeDnpFar: true,

            // 🔹 Grau de perto (novos)
            odSphericalNear: true,
            odCylindricalNear: true,
            odAxisNear: true,
            odDnpNear: true,
            oeSphericalNear: true,
            oeCylindricalNear: true,
            oeAxisNear: true,
            oeDnpNear: true,

            // 🔹 Películas
            odPellicleFar: true,
            odPellicleNear: true,
            oePellicleFar: true,
            oePellicleNear: true,

            // 🔹 Gerais
            frameAndRef: true,
            lensType: true,
            notes: true,

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
    clientId?: number,
    clientName?: string, // Novo parâmetro
  ) {
    const skip = (page - 1) * limit;

    // Construir where dinamicamente
    const where: any = { tenantId };

    if (clientId) {
      where.clientId = clientId;
    }

    // Adicionar filtro por nome do cliente (MySQL compatível)
    if (clientName) {
      where.client = {
        name: {
          contains: clientName,
          // Remover 'mode: insensitive' - não suportado no MySQL
        },
      };
    }

    const [items, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { saleDate: "desc" },
        select: {
          id: true,
          clientId: true,
          saleDate: true,
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
          protocol: {
            select: {
              id: true,
              book: true,
              page: true,
              os: true,
            },
          },
          prescription: {
            select: {
              id: true,
              prescriptionDate: true,
              doctorName: true,
            },
          },
        },
      }),
      prisma.sale.count({ where }),
    ]);

    return { items, total };
  }

  async findByClientId(clientId: number, tenantId: string) {
    return prisma.sale.findMany({
      where: { tenantId, clientId },
      orderBy: { saleDate: "desc" },
      select: {
        id: true,
        clientId: true,
        saleDate: true,
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
        protocol: {
          select: {
            id: true,
            book: true,
            page: true,
            os: true,
          },
        },
        productItems: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            product: {
              select: {
                id: true,
                name: true,
                salePrice: true,
                category: true,
              },
            },
          },
        },
        serviceItems: {
          select: {
            id: true,
            serviceId: true,
            service: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
          },
        },
      },
    });
  }

  async findProtocolBySale(saleId: number) {
    return prisma.protocol.findFirst({ where: { saleId } });
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
    return prisma.frameDetails.findFirst({ where: { itemProductId } });
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
