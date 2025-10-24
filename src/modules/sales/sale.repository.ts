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
        // 
        // ❗️ CORREÇÃO AQUI: 
        // Alterado de "data.prescriptionId" para um "select"
        // para incluir os dados da prescrição relacionada.
        // 
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
        // 
        // ❗️ ADIÇÃO (SUGESTÃO): 
        // Adicionado para consistência, para que o update
        // também retorne os dados da prescrição.
        // 
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
        // 
        // ❗️ CORREÇÃO PRINCIPAL AQUI:
        // Os campos "odSpherical", "oeSpherical", etc., foram
        // substituídos pelos campos corretos ("...Far", "...Near").
        // 
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
            // Você pode adicionar mais campos da prescrição aqui se precisar
            // ex: frameAndRef, lensType, notes, etc.
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
          // ❗️ NOTA: Esta consulta "findAll" NÃO inclui a prescrição
          // com todos os detalhes, apenas o ID. Se você precisar 
          // dos detalhes na listagem, adicione o "include"
          // ou "select" de prescrição aqui também.
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