// src/modules/sales/sale.repository.ts
import { Prisma } from "@prisma/client";
import { prisma, withAuditData } from "../../config/prisma-context";

const prescriptionSelect = {
  id: true,
  clientId: true,
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
  odPellicleFar: true,
  odPellicleNear: true,
  oePellicleFar: true,
  oePellicleNear: true,
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
} satisfies Prisma.PrescriptionSelect;

const saleIncludeFull = {
  client: {
    select: { id: true, name: true, cpf: true, email: true, phone01: true },
  },
  protocol: true,
  payment: {
    select: {
      status: true,
    },
  },
  prescription: { select: prescriptionSelect },
  productItems: {
    select: {
      id: true,
      productId: true,
      quantity: true,
      unitPrice: true,
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
      unitPrice: true,
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
} satisfies Prisma.SaleInclude;

export class SaleRepository {
  async create(data: Prisma.SaleUncheckedCreateInput, userId?: string) {
    return prisma.sale.create({
      data: withAuditData(userId, data),
      include: saleIncludeFull,
    });
  }

  async update(
    id: number,
    data: Prisma.SaleUncheckedUpdateInput,
    userId?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? prisma;
    return client.sale.update({
      where: { id },
      data: withAuditData(userId, data),
      include: saleIncludeFull,
    });
  }

  async findById(id: number, tenantId: string) {
    return prisma.sale.findFirst({
      where: { id, tenantId, isActive: true },
      include: saleIncludeFull,
    });
  }

  async findAllByTenant(
    tenantId: string,
    page: number,
    limit: number,
    clientId?: number,
    clientName?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.SaleWhereInput = { tenantId, isActive: true };

    if (clientId) where.clientId = clientId;
    if (clientName) where.client = { name: { contains: clientName } };

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
            select: { id: true, name: true, cpf: true, email: true, phone01: true },
          },
          protocol: { select: { id: true, book: true, page: true, os: true } },
          prescription: {
            select: { id: true, prescriptionDate: true, doctorName: true },
          },
        },
      }),
      prisma.sale.count({ where }),
    ]);

    return { items, total };
  }

  async findByClientId(clientId: number, tenantId: string) {
    return prisma.sale.findMany({
      where: { tenantId, clientId, isActive: true },
      orderBy: { saleDate: "desc" },
      include: saleIncludeFull,
    });
  }

  async findProtocolBySale(saleId: number) {
    return prisma.protocol.findFirst({ where: { saleId } });
  }

  async createProtocol(
    data: Prisma.ProtocolUncheckedCreateInput,
    userId?: string,
  ) {
    return prisma.protocol.create({ data: withAuditData(userId, data) });
  }

  async updateProtocol(
    id: number,
    data: Prisma.ProtocolUncheckedUpdateInput,
    userId?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? prisma;
    return client.protocol.update({
      where: { id },
      data: withAuditData(userId, data),
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

  async findOpticalServiceItemsBySale(saleId: number) {
    return prisma.itemOpticalService.findMany({
      where: { saleId },
      include: { service: { select: { id: true, name: true } } },
    });
  }

  async hardDelete(id: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.sale.delete({ where: { id } });
  }
}
