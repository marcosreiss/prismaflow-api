import { Request } from "express";
import { prisma } from "@/config/prisma-context";
import { ApiResponse } from "@/responses/ApiResponse";
import { PagedResponse } from "@/responses/PagedResponse";
import { AppError } from "@/utils/app-error";
import logger from "@/utils/logger";
import { SaleRepository } from "./sale.repository";
import { CreateSaleDto, UpdateSaleDto } from "./dtos/sale.dto";
import { SaleItemsService } from "./services/sale-items.service";
import { SaleUpdateStateService } from "./services/sale-update-state.service";
import { SaleValidationService } from "./services/sale-validation.service";

export class SaleService {
  private saleRepo = new SaleRepository();
  private saleValidation = new SaleValidationService();
  private saleItems = new SaleItemsService();
  private saleUpdateState = new SaleUpdateStateService();

  async create(req: Request) {
    const { userId, tenantId, branchId } = this.saleValidation.extractUser(req);
    const body = req.body as CreateSaleDto;

    const hasItems =
      (body.productItems?.length ?? 0) > 0 ||
      (body.serviceItems?.length ?? 0) > 0;

    if (!hasItems) {
      throw new AppError("É necessário pelo menos um produto ou serviço.", 400);
    }

    await this.saleValidation.validateClient(body.clientId, tenantId);
    this.saleValidation.validateSaleDate(body.saleDate);

    if (body.prescriptionId) {
      await this.saleValidation.validatePrescription(
        body.prescriptionId,
        body.clientId,
        tenantId,
      );
    }

    return prisma.$transaction(async (tx) => {
      const { subtotal } = await this.saleItems.calculateCreateTotals(
        body.productItems ?? [],
        body.serviceItems ?? [],
        tenantId,
        tx,
      );

      const discount = body.discount ?? 0;
      const total = subtotal - discount;

      const sale = await tx.sale.create({
        data: {
          clientId: body.clientId,
          saleDate: body.saleDate,
          prescriptionId: body.prescriptionId ?? null,
          subtotal,
          discount,
          total,
          notes: body.notes ?? null,
          isActive: true,
          tenantId,
          branchId,
          createdById: userId,
          updatedById: userId,
        },
      });

      if (body.productItems?.length) {
        await this.saleItems.createProductItems(
          sale.id,
          body.productItems,
          tenantId,
          branchId,
          userId,
          tx,
        );
      }

      if (body.serviceItems?.length) {
        await this.saleItems.createServiceItems(
          sale.id,
          body.serviceItems,
          tenantId,
          branchId,
          userId,
          tx,
        );
      }

      if (body.protocol) {
        await this.saleItems.upsertProtocol(
          sale.id,
          body.protocol,
          tenantId,
          branchId,
          userId,
          tx,
        );
      }

      await tx.payment.create({
        data: {
          saleId: sale.id,
          status: "PENDING",
          subtotal: total,
          discount: 0,
          total,
          paidAmount: 0,
          installmentsPaid: 0,
          lastPaymentAt: null,
          isActive: true,
          tenantId,
          branchId,
          createdById: userId,
          updatedById: userId,
        },
      });

      logger.info("Sale criada com sucesso", { saleId: sale.id });

      const createdSale = await this.saleRepo.findById(sale.id, tenantId);

      return ApiResponse.success("Venda criada com sucesso.", req, createdSale);
    });
  }

  async update(req: Request) {
    const { userId, tenantId, branchId } = this.saleValidation.extractUser(req);
    const saleId = this.saleValidation.validateSaleId(req.params.id);
    const body = req.body as UpdateSaleDto;

    const sale = await this.saleRepo.findById(saleId, tenantId);

    if (!sale) {
      throw new AppError("Venda não encontrada.", 404);
    }

    const changedFields = this.saleUpdateState.getChangedSaleFields(body, sale);
    const { hasPaymentActivity } = await this.saleUpdateState.getSalePaymentState(
      saleId,
      tenantId,
    );

    if (hasPaymentActivity) {
      this.saleUpdateState.ensureEditableFieldsWhenPaymentStarted(
        sale,
        changedFields,
      );
    }

    const nextClientId = changedFields.clientId ?? sale.clientId;

    if (changedFields.clientId) {
      await this.saleValidation.validateClient(changedFields.clientId, tenantId);
    }

    if (changedFields.saleDate) {
      this.saleValidation.validateSaleDate(changedFields.saleDate);
    }

    if (changedFields.prescriptionId) {
      await this.saleValidation.validatePrescription(
        changedFields.prescriptionId,
        nextClientId,
        tenantId,
      );
    }

    return prisma.$transaction(async (tx) => {
      if (changedFields.productItems !== undefined && hasPaymentActivity) {
        await this.saleItems.syncFrameDetailsOnly(
          saleId,
          changedFields.productItems,
          sale,
          tenantId,
          branchId,
          userId,
          tx,
        );
      } else if (changedFields.productItems !== undefined) {
        await this.saleItems.replaceProductItems(
          saleId,
          changedFields.productItems,
          tenantId,
          branchId,
          userId,
          tx,
        );
      }

      if (changedFields.serviceItems !== undefined) {
        await this.saleItems.replaceServiceItems(
          saleId,
          changedFields.serviceItems,
          tenantId,
          branchId,
          userId,
          tx,
        );
      }

      if (changedFields.protocol) {
        await this.saleItems.upsertProtocol(
          saleId,
          changedFields.protocol,
          tenantId,
          branchId,
          userId,
          tx,
        );
      }

      const subtotal = hasPaymentActivity
        ? (sale.subtotal ?? 0)
        : await this.saleItems.calculateCurrentSaleSubtotal(saleId, tx);
      const discount = hasPaymentActivity
        ? (sale.discount ?? 0)
        : (changedFields.discount ?? sale.discount ?? 0);
      const total = subtotal - discount;

      const normalizedSaleDate =
        changedFields.saleDate !== undefined
          ? this.saleValidation.normalizeSaleDateForPersistence(
            changedFields.saleDate,
            {
              saleId,
              source: "changedFields",
            },
          )
          : this.saleValidation.normalizeSaleDateForPersistence(sale.saleDate, {
            saleId,
            source: "storedSale",
          });

      logger.debug("Prepared sale payload for update.", {
        saleId,
        incomingSaleDate:
          changedFields.saleDate instanceof Date
            ? changedFields.saleDate.toISOString()
            : changedFields.saleDate,
        storedSaleDate:
          sale.saleDate instanceof Date ? sale.saleDate.toISOString() : sale.saleDate,
        normalizedSaleDate:
          normalizedSaleDate instanceof Date
            ? normalizedSaleDate.toISOString()
            : normalizedSaleDate,
        changedFieldKeys: Object.keys(changedFields),
      });

      await tx.sale.update({
        where: { id: saleId },
        data: {
          clientId: nextClientId,
          saleDate: normalizedSaleDate,
          prescriptionId:
            changedFields.prescriptionId !== undefined
              ? changedFields.prescriptionId
              : sale.prescriptionId,
          notes: changedFields.notes ?? sale.notes,
          subtotal,
          discount,
          total,
          updatedById: userId,
        },
      });

      if (!hasPaymentActivity) {
        await tx.payment.update({
          where: { saleId },
          data: {
            subtotal: total,
            total,
            updatedById: userId,
          },
        });
      }

      const updatedSale = await this.saleRepo.findById(saleId, tenantId);

      logger.info("Sale atualizada com sucesso", { saleId });

      return ApiResponse.success(
        "Venda atualizada com sucesso.",
        req,
        updatedSale,
      );
    });
  }

  async findAll(req: Request) {
    const { tenantId } = this.saleValidation.extractUser(req);

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const clientId = req.query.clientId
      ? Number(req.query.clientId)
      : undefined;
    const clientName = req.query.clientName
      ? String(req.query.clientName)
      : undefined;

    const { items, total } = await this.saleRepo.findAllByTenant(
      tenantId,
      page,
      limit,
      clientId,
      clientName,
    );

    return new PagedResponse(
      "Vendas listadas com sucesso.",
      req,
      items,
      page,
      limit,
      total,
    );
  }

  async findById(req: Request) {
    const { tenantId } = this.saleValidation.extractUser(req);
    const saleId = this.saleValidation.validateSaleId(req.params.id);

    const sale = await this.saleRepo.findById(saleId, tenantId);

    if (!sale) {
      throw new AppError("Venda não encontrada.", 404);
    }

    return ApiResponse.success("Venda encontrada.", req, sale);
  }

  async findByClient(req: Request) {
    const { tenantId } = this.saleValidation.extractUser(req);
    const clientId = this.saleValidation.validateSaleId(req.params.clientId);

    await this.saleValidation.validateClient(clientId, tenantId);

    const sales = await this.saleRepo.findByClientId(clientId, tenantId);

    return ApiResponse.success(
      "Vendas do cliente listadas com sucesso.",
      req,
      sales,
    );
  }

  async delete(req: Request) {
    const { userId, tenantId } = this.saleValidation.extractUser(req);
    const saleId = this.saleValidation.validateSaleId(req.params.id);

    const sale = await this.saleRepo.findById(saleId, tenantId);

    if (!sale) {
      throw new AppError("Venda não encontrada.", 404);
    }

    const payment = await prisma.payment.findFirst({
      where: {
        saleId,
        tenantId,
      },
    });

    if (!payment) {
      throw new AppError("Pagamento não encontrado para esta venda.", 404);
    }

    await prisma.$transaction(async (tx) => {
      const productItems = await tx.itemProduct.findMany({
        where: { saleId },
      });

      for (const item of productItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              increment: item.quantity,
            },
            updatedById: userId,
          },
        });
      }

      await tx.paymentInstallment.deleteMany({
        where: {
          paymentMethodItem: {
            paymentId: payment.id,
          },
        },
      });

      await tx.paymentMethodItem.deleteMany({
        where: {
          paymentId: payment.id,
        },
      });

      await tx.payment.delete({
        where: {
          id: payment.id,
        },
      });

      await tx.frameDetails.deleteMany({
        where: {
          itemProduct: {
            saleId,
          },
        },
      });

      await tx.itemProduct.deleteMany({
        where: { saleId },
      });

      await tx.itemOpticalService.deleteMany({
        where: { saleId },
      });

      await tx.protocol.deleteMany({
        where: { saleId },
      });

      await tx.sale.delete({
        where: { id: saleId },
      });
    });

    logger.info("Sale removida com sucesso", { saleId });

    return ApiResponse.success("Venda removida com sucesso.", req, null);
  }
}
