import { Request } from "express";
import { SaleRepository } from "./sale.repository";
import { ProductRepository } from "../products/product.repository";
import { OpticalServiceRepository } from "../optical-services/optical-service.repository";
import { PaymentRepository } from "../payments/payment.repository";
import { ClientRepository } from "../clients/client.repository";
import { prisma, withAuditData } from "../../config/prisma-context";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { UpdateSaleDto } from "./dtos/sale.dto";

export class SaleService {
  private saleRepo = new SaleRepository();
  private productRepo = new ProductRepository();
  private opticalRepo = new OpticalServiceRepository();
  private paymentRepo = new PaymentRepository();
  private clientRepo = new ClientRepository();

  // ======================================================
  // CREATE SALE
  // ======================================================
  async create(req: Request) {
    const user = req.user as any;
    const { sub: userId, tenantId, branchId } = user;
    const body = req.body;

    const errors: string[] = [];

    // 1️⃣ Cliente
    const client = await this.clientRepo.findById(
      body.clientId,
      req.user?.tenantId!
    );
    if (!client) errors.push("Cliente não encontrado.");

    // 2️⃣ Itens obrigatórios
    const hasItems =
      (body.productItems && body.productItems.length > 0) ||
      (body.serviceItems && body.serviceItems.length > 0);
    if (!hasItems)
      errors.push("É necessário pelo menos um produto ou serviço.");

    if (errors.length) {
      return ApiResponse.error(errors.join("; "), 400, req);
    }

    // 3️⃣ Criar venda
    const sale = await this.saleRepo.create(
      {
        clientId: body.clientId,
        tenantId,
        branchId,
        subtotal: body.subtotal,
        discount: body.discount ?? 0,
        total: body.total,
        notes: body.notes,
        isActive: true,
      },
      userId
    );

    // 4️⃣ Protocolo (opcional)
    if (body.protocol) {
      await this.saleRepo.createProtocol(
        {
          saleId: sale.id,
          tenantId,
          branchId,
          recordNumber: body.protocol.recordNumber,
          book: body.protocol.book,
          page: body.protocol.page,
          os: body.protocol.os,
          isActive: true,
        },
        userId
      );
    }

    // 5️⃣ Itens de produto
    if (body.productItems?.length) {
      for (const item of body.productItems) {
        const product = await this.productRepo.findById(item.productId);
        if (!product)
          return ApiResponse.error(
            `Produto não encontrado: ${item.productId}`,
            404,
            req
          );

        if ((product.stockQuantity ?? 0) < item.quantity)
          return ApiResponse.error(
            `Estoque insuficiente para ${product.name}`,
            409,
            req
          );

        // Baixa de estoque
        await this.productRepo.update(
          product.id,
          {
            stockQuantity: (product.stockQuantity ?? 0) - item.quantity,
          },
          userId
        );

        // Criação do item
        const itemProduct = await prisma.itemProduct.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            quantity: item.quantity,
            tenantId,
            branchId,
            createdById: userId,
            updatedById: userId,
          },
        });

        // Frame details se necessário
        if (product.category === "FRAME" && item.frameDetails) {
          await prisma.frameDetails.create({
            data: {
              itemProductId: itemProduct.id,
              material: item.frameDetails.material,
              reference: item.frameDetails.reference,
              color: item.frameDetails.color,
              tenantId,
              branchId,
              createdById: userId,
              updatedById: userId,
            },
          });
        }
      }
    }

    // 6️⃣ Itens de serviço
    if (body.serviceItems?.length) {
      for (const item of body.serviceItems) {
        const service = await this.opticalRepo.findById(item.serviceId);
        if (!service)
          return ApiResponse.error(
            `Serviço não encontrado: ${item.serviceId}`,
            404,
            req
          );

        await prisma.itemOpticalService.create({
          data: {
            saleId: sale.id,
            serviceId: item.serviceId,
            tenantId,
            branchId,
            createdById: userId,
            updatedById: userId,
          },
        });
      }
    }

    // 7️⃣ Pagamento inicial
    const payment = await this.paymentRepo.create(
      {
        saleId: sale.id,
        tenantId,
        branchId,
        total: sale.total,
        discount: sale.discount ?? 0,
        paidAmount: 0,
        status: "PENDING",
      },
      userId
    );

    // 8️⃣ Retorno
    return ApiResponse.success("Venda criada com sucesso.", req, {
      saleId: sale.id,
      clientId: sale.clientId,
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      payment,
    });
  }

  // ======================================================
  // UPDATE SALE
  // ======================================================
  async updateSale(req: Request) {
    const { id } = req.params;
    const body = req.body as UpdateSaleDto;
    const userId = req.user?.sub;
    const tenantId = req.user?.tenantId!;
    const branchId = req.user?.branchId!;

    const sale = await this.saleRepo.findById(Number(id), tenantId);
    if (!sale) throw new Error(`Venda ${id} não encontrada`);

    const payment = await prisma.payment.findFirst({
      where: { saleId: Number(id) },
    });
    if (!payment) throw new Error("Pagamento não encontrado para esta venda.");

    if (payment.status !== "PENDING" || (payment.paidAmount ?? 0) > 0)
      throw new Error("Venda não pode ser editada com pagamento iniciado.");

    if (body.clientId) {
      const client = await this.clientRepo.findById(body.clientId, tenantId);
      if (!client) throw new Error("Cliente não encontrado.");
    }

    const updatedSale = await this.saleRepo.update(
      Number(id),
      {
        clientId: body.clientId ?? sale.clientId,
        subtotal: body.subtotal ?? sale.subtotal,
        discount: body.discount ?? sale.discount,
        total: body.total ?? sale.total,
        notes: body.notes ?? sale.notes,
        isActive: body.isActive ?? sale.isActive,
      },
      userId
    );

    // Demais blocos permanecem idênticos,
    // apenas troca de `prisma.protocol.create/update` → saleRepo.createProtocol/updateProtocol:
    if (body.protocol) {
      const existingProtocol = await this.saleRepo.findProtocolBySale(
        Number(id)
      );

      if (!existingProtocol) {
        await this.saleRepo.createProtocol(
          {
            saleId: Number(id),
            tenantId,
            branchId,
            recordNumber: body.protocol.recordNumber,
            book: body.protocol.book,
            page: body.protocol.page,
            os: body.protocol.os,
          },
          userId
        );
      } else {
        await this.saleRepo.updateProtocol(
          existingProtocol.id,
          {
            recordNumber: body.protocol.recordNumber,
            book: body.protocol.book,
            page: body.protocol.page,
            os: body.protocol.os,
          },
          userId
        );
      }
    }

    await prisma.payment.update({
      where: { saleId: Number(id) },
      data: withAuditData(
        userId,
        { total: Number(body.total ?? sale.total) },
        true
      ),
    });

    const result = await this.saleRepo.findById(Number(id), tenantId);
    return ApiResponse.success("Venda atualizada com sucesso.", req, result);
  }

  // ======================================================
  // LIST SALES
  // ======================================================
  async findAll(req: Request) {
    const user = req.user as any;
    const { tenantId } = user;
    const { page = 1, limit = 10, clientId } = req.query;

    const { items, total } = await this.saleRepo.findAllByTenant(
      tenantId,
      Number(page),
      Number(limit),
      clientId ? Number(clientId) : undefined
    );

    return new PagedResponse(
      "Vendas listadas com sucesso.",
      req,
      items,
      Number(page),
      Number(limit),
      total
    );
  }

  // ======================================================
  // FIND BY ID
  // ======================================================
  async findById(req: Request) {
    const user = req.user as any;
    const { tenantId } = user;
    const { id } = req.params;

    const sale = await this.saleRepo.findById(Number(id), tenantId);
    if (!sale) return ApiResponse.error("Venda não encontrada.", 404, req);

    return ApiResponse.success("Venda encontrada.", req, sale);
  }

  // ======================================================
  // DELETE SALE
  // ======================================================
  async delete(req: Request) {
    const user = req.user as any;
    const { sub: userId, tenantId } = user;
    const { id } = req.params;

    const sale = await this.saleRepo.findById(Number(id), tenantId);
    if (!sale) return ApiResponse.error("Venda não encontrada.", 404, req);

    const payment = await this.paymentRepo.findBySaleId(Number(id));
    if (!payment)
      return ApiResponse.error("Pagamento não encontrado.", 404, req);

    if (payment.status === "CONFIRMED" || payment.paidAmount > 0) {
      return ApiResponse.error(
        "Não é possível excluir uma venda já paga ou parcialmente paga.",
        409,
        req
      );
    }

    const productItems = await this.saleRepo.findProductItemsBySale(Number(id));
    for (const item of productItems) {
      await this.productRepo.update(
        item.productId,
        {
          stockQuantity: (item.product.stockQuantity ?? 0) + item.quantity,
        },
        userId
      );
      await prisma.frameDetails.deleteMany({
        where: { itemProductId: item.id },
      });
      await prisma.itemProduct.delete({ where: { id: item.id } });
    }

    await prisma.itemOpticalService.deleteMany({
      where: { saleId: Number(id) },
    });

    const protocol = await this.saleRepo.findProtocolBySale(Number(id));
    if (protocol) await prisma.protocol.delete({ where: { id: protocol.id } });

    await prisma.payment.delete({ where: { saleId: Number(id) } });
    await this.saleRepo.softDelete(Number(id), userId);

    return ApiResponse.success("Venda removida com sucesso.", req);
  }
}
