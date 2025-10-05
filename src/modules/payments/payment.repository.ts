import { prisma, withAuditData } from "../../config/prisma-context";

export class PaymentRepository {
  // 🔹 Criar pagamento
  async create(data: any, userId?: string) {
    return prisma.payment.create({
      data: withAuditData(userId, data),
      include: {
        sale: { select: { id: true, clientId: true, total: true } },
        installments: true,
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  // 🔹 Atualizar pagamento
  async update(id: number, data: any, userId?: string) {
    return prisma.payment.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: {
        sale: { select: { id: true, clientId: true, total: true } },
        installments: true,
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  // 🔹 Buscar por ID
  async findById(id: number) {
    return prisma.payment.findUnique({
      where: { id },
      include: {
        sale: { select: { id: true, clientId: true, total: true } },
        installments: true,
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  // 🔹 Buscar pagamento de uma venda específica
  async findBySaleId(saleId: number) {
    return prisma.payment.findUnique({
      where: { saleId },
      include: {
        installments: true,
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  // 🔹 Listar todos por tenant (com paginação e filtro por status)
  async findAllByTenant(
    tenantId: string,
    page: number,
    limit: number,
    status?: string
  ) {
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          sale: { select: { id: true, clientId: true, total: true } },
          installments: true,
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return { items, total };
  }

  // 🔹 Buscar parcelas de um pagamento
  async findInstallmentsByPayment(paymentId: number) {
    return prisma.paymentInstallment.findMany({
      where: { paymentId },
      orderBy: { sequence: "asc" },
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  // 🔹 Criar parcela
  async createInstallment(paymentId: number, data: any, userId?: string) {
    return prisma.paymentInstallment.create({
      data: withAuditData(userId, { ...data, paymentId }),
      include: {
        payment: { select: { id: true, saleId: true } },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  // 🔹 Atualizar parcela
  async updateInstallment(id: number, data: any, userId?: string) {
    return prisma.paymentInstallment.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: {
        payment: { select: { id: true, saleId: true } },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  // 🔹 Exclusão lógica de pagamento
  async softDelete(id: number, userId?: string) {
    return prisma.payment.update({
      where: { id },
      data: withAuditData(userId, { isActive: false }, true),
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  // 🔹 Exclusão lógica de parcela
  async softDeleteInstallment(id: number, userId?: string) {
    return prisma.paymentInstallment.update({
      where: { id },
      data: withAuditData(userId, { isActive: false }, true),
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }
}
