// src/modules/sales/sale.service.ts
import { Request } from "express";
import { Prisma } from "@prisma/client";
import { SaleRepository } from "./sale.repository";
import { ProductRepository } from "../products/product.repository";
import { OpticalServiceRepository } from "../optical-services/optical-service.repository";
import { ClientRepository } from "../clients/client.repository";
import { prisma } from "@/config/prisma-context";
import { ApiResponse } from "@/responses/ApiResponse";
import { PagedResponse } from "@/responses/PagedResponse";
import { CreateSaleDto, UpdateSaleDto } from "./dtos/sale.dto";
import {
  CreateItemProductDto,
  UpdateItemProductDto,
} from "./dtos/item-product.dto";
import { AppError } from "@/utils/app-error";
import { getChangedFields } from "@/utils/changed-fields";
import logger from "@/utils/logger";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type ComparableSaleState = {
  clientId: number;
  saleDate: Date | null;
  prescriptionId: number | null;
  notes: string | null;
  discount: number;
  productItems: Array<{
    productId: number;
    quantity: number;
    frameDetails: {
      material: string | null;
      reference: string | null;
      color: string | null;
    } | null;
  }>;
  serviceItems: Array<{
    serviceId: number;
  }>;
  protocol: {
    book: string | null;
    page: number | null;
    os: string | null;
  } | null;
};

export class SaleService {
  private saleRepo = new SaleRepository();
  private productRepo = new ProductRepository();
  private opticalRepo = new OpticalServiceRepository();
  private clientRepo = new ClientRepository();

  private extractUser(req: Request) {
    const user = req.user;

    if (!user?.sub || !user?.tenantId || !user?.branchId) {
      throw new AppError("Usuário autenticado inválido.", 401);
    }

    return {
      userId: user.sub,
      tenantId: user.tenantId,
      branchId: user.branchId,
    };
  }

  private validateSaleId(idParam: string) {
    const id = Number(idParam);

    if (Number.isNaN(id) || id <= 0) {
      throw new AppError("ID inválido.", 400);
    }

    return id;
  }

  private validateSaleDate(saleDate: Date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const normalizedSaleDate = new Date(saleDate);
    normalizedSaleDate.setHours(0, 0, 0, 0);

    if (normalizedSaleDate > today) {
      throw new AppError("A data da venda não pode ser futura.", 400);
    }
  }

  private normalizeSaleDateForPersistence(
    saleDate: Date | string | null | undefined,
    context: {
      saleId: number;
      source: "changedFields" | "storedSale";
    },
  ) {
    if (saleDate == null) {
      return undefined;
    }

    if (saleDate instanceof Date) {
      if (Number.isNaN(saleDate.getTime())) {
        logger.error("Sale update received invalid Date instance for saleDate.", {
          saleId: context.saleId,
          source: context.source,
        });
        throw new AppError("Data da venda inválida.", 400);
      }

      return saleDate;
    }

    const normalizedDate = new Date(saleDate);

    if (Number.isNaN(normalizedDate.getTime())) {
      logger.error("Sale update could not parse saleDate string.", {
        saleId: context.saleId,
        source: context.source,
        saleDate,
      });
      throw new AppError("Data da venda inválida.", 400);
    }

    logger.debug("Sale update normalized string saleDate before persistence.", {
      saleId: context.saleId,
      source: context.source,
      originalSaleDate: saleDate,
      normalizedSaleDate: normalizedDate.toISOString(),
    });

    return normalizedDate;
  }

  private async validateClient(clientId: number, tenantId: string) {
    const client = await this.clientRepo.findById(clientId, tenantId);

    if (!client) {
      throw new AppError("Cliente não encontrado.", 404);
    }

    return client;
  }

  private async validatePrescription(
    prescriptionId: number,
    clientId: number,
    tenantId: string,
  ) {
    const prescription = await prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        clientId,
        tenantId,
        isActive: true,
      },
    });

    if (!prescription) {
      throw new AppError(
        "Receita não encontrada ou não pertence a este cliente.",
        404,
      );
    }

    return prescription;
  }

  private async resolveProductItems(
    items: CreateItemProductDto[] | UpdateItemProductDto[],
    tenantId: string,
    tx: TxClient,
  ) {
    const resolved: Array<{
      item: CreateItemProductDto | UpdateItemProductDto;
      product: {
        id: number;
        name: string;
        salePrice: number | null;
        stockQuantity: number | null;
        category: Prisma.ProductScalarFieldEnum | any;
      };
      quantity: number;
    }> = [];

    for (const item of items) {
      const quantity = item.quantity ?? 1;

      if (quantity < 1) {
        throw new AppError(
          `Quantidade inválida para o produto ${item.productId}.`,
          400,
        );
      }

      const product = await tx.product.findFirst({
        where: {
          id: item.productId,
          tenantId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          salePrice: true,
          stockQuantity: true,
          category: true,
        },
      });

      if (!product) {
        throw new AppError(`Produto ${item.productId} não encontrado.`, 404);
      }

      resolved.push({
        item,
        product,
        quantity,
      });
    }

    return resolved;
  }

  private async resolveServiceItems(
    items: Array<{ serviceId: number }>,
    tenantId: string,
    tx: TxClient,
  ) {
    const resolved: Array<{
      item: { serviceId: number };
      service: {
        id: number;
        name: string;
        price: number;
      };
    }> = [];

    for (const item of items) {
      const service = await tx.opticalService.findFirst({
        where: {
          id: item.serviceId,
          tenantId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          price: true,
        },
      });

      if (!service) {
        throw new AppError(`Serviço ${item.serviceId} não encontrado.`, 404);
      }

      resolved.push({ item, service });
    }

    return resolved;
  }

  private async calculateCreateTotals(
    productItems: CreateItemProductDto[],
    serviceItems: Array<{ serviceId: number }>,
    tenantId: string,
    tx: TxClient,
  ) {
    const resolvedProducts = await this.resolveProductItems(
      productItems,
      tenantId,
      tx,
    );
    const resolvedServices = await this.resolveServiceItems(
      serviceItems,
      tenantId,
      tx,
    );

    const productSubtotal = resolvedProducts.reduce((acc, current) => {
      return acc + (current.product.salePrice ?? 0) * current.quantity;
    }, 0);

    const serviceSubtotal = resolvedServices.reduce((acc, current) => {
      return acc + current.service.price;
    }, 0);

    return {
      subtotal: productSubtotal + serviceSubtotal,
      resolvedProducts,
      resolvedServices,
    };
  }

  private async createProductItems(
    saleId: number,
    items: CreateItemProductDto[],
    tenantId: string,
    branchId: string,
    userId: string,
    tx: TxClient,
  ) {
    const resolvedProducts = await this.resolveProductItems(
      items,
      tenantId,
      tx,
    );

    for (const { item, product, quantity } of resolvedProducts) {
      if ((product.stockQuantity ?? 0) < quantity) {
        throw new AppError(`Estoque insuficiente para ${product.name}.`, 409);
      }

      await tx.product.update({
        where: { id: product.id },
        data: {
          stockQuantity: {
            decrement: quantity,
          },
          updatedById: userId,
        },
      });

      const itemProduct = await tx.itemProduct.create({
        data: {
          saleId,
          productId: product.id,
          quantity,
          unitPrice: product.salePrice ?? 0,
          tenantId,
          branchId,
          createdById: userId,
          updatedById: userId,
        },
      });

      if (product.category === "FRAME" && item.frameDetails) {
        if (!item.frameDetails.material) {
          throw new AppError(
            "O campo material é obrigatório para frameDetails.",
            400,
          );
        }

        await tx.frameDetails.create({
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

  private async replaceProductItems(
    saleId: number,
    items: UpdateItemProductDto[],
    tenantId: string,
    branchId: string,
    userId: string,
    tx: TxClient,
  ) {
    const oldItems = await tx.itemProduct.findMany({
      where: { saleId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            stockQuantity: true,
          },
        },
        frameDetails: true,
      },
    });

    const resolvedProducts = await this.resolveProductItems(
      items,
      tenantId,
      tx,
    );
    const incomingMap = new Map(
      resolvedProducts.map((entry) => [entry.product.id, entry.quantity]),
    );

    for (const oldItem of oldItems) {
      const newQuantity = incomingMap.get(oldItem.productId);

      if (newQuantity === undefined) {
        await tx.product.update({
          where: { id: oldItem.productId },
          data: {
            stockQuantity: {
              increment: oldItem.quantity,
            },
            updatedById: userId,
          },
        });
        continue;
      }

      const diff = newQuantity - oldItem.quantity;

      if (diff > 0) {
        if ((oldItem.product.stockQuantity ?? 0) < diff) {
          throw new AppError(
            `Estoque insuficiente para ${oldItem.product.name}.`,
            409,
          );
        }

        await tx.product.update({
          where: { id: oldItem.productId },
          data: {
            stockQuantity: {
              decrement: diff,
            },
            updatedById: userId,
          },
        });
      }

      if (diff < 0) {
        await tx.product.update({
          where: { id: oldItem.productId },
          data: {
            stockQuantity: {
              increment: Math.abs(diff),
            },
            updatedById: userId,
          },
        });
      }
    }

    const oldProductIds = new Set(oldItems.map((item) => item.productId));

    for (const { product, quantity } of resolvedProducts) {
      if (oldProductIds.has(product.id)) continue;

      if ((product.stockQuantity ?? 0) < quantity) {
        throw new AppError(`Estoque insuficiente para ${product.name}.`, 409);
      }

      await tx.product.update({
        where: { id: product.id },
        data: {
          stockQuantity: {
            decrement: quantity,
          },
          updatedById: userId,
        },
      });
    }

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

    for (const { item, product, quantity } of resolvedProducts) {
      const itemProduct = await tx.itemProduct.create({
        data: {
          saleId,
          productId: product.id,
          quantity,
          unitPrice: product.salePrice ?? 0,
          tenantId,
          branchId,
          createdById: userId,
          updatedById: userId,
        },
      });

      if (product.category === "FRAME" && item.frameDetails) {
        if (!item.frameDetails.material) {
          throw new AppError(
            "O campo material é obrigatório para frameDetails.",
            400,
          );
        }

        await tx.frameDetails.create({
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

  private async createServiceItems(
    saleId: number,
    items: Array<{ serviceId: number }>,
    tenantId: string,
    branchId: string,
    userId: string,
    tx: TxClient,
  ) {
    const resolvedServices = await this.resolveServiceItems(
      items,
      tenantId,
      tx,
    );

    for (const { service } of resolvedServices) {
      await tx.itemOpticalService.create({
        data: {
          saleId,
          serviceId: service.id,
          unitPrice: service.price,
          tenantId,
          branchId,
          createdById: userId,
          updatedById: userId,
        },
      });
    }
  }

  private async replaceServiceItems(
    saleId: number,
    items: Array<{ serviceId: number }>,
    tenantId: string,
    branchId: string,
    userId: string,
    tx: TxClient,
  ) {
    const resolvedServices = await this.resolveServiceItems(
      items,
      tenantId,
      tx,
    );

    await tx.itemOpticalService.deleteMany({
      where: { saleId },
    });

    for (const { service } of resolvedServices) {
      await tx.itemOpticalService.create({
        data: {
          saleId,
          serviceId: service.id,
          unitPrice: service.price,
          tenantId,
          branchId,
          createdById: userId,
          updatedById: userId,
        },
      });
    }
  }

  private async upsertProtocol(
    saleId: number,
    protocol: {
      book?: string;
      page?: number;
      os?: string;
    },
    tenantId: string,
    branchId: string,
    userId: string,
    tx: TxClient,
  ) {
    const existingProtocol = await tx.protocol.findFirst({
      where: { saleId },
    });

    if (!existingProtocol) {
      await tx.protocol.create({
        data: {
          saleId,
          book: protocol.book,
          page: protocol.page,
          os: protocol.os,
          tenantId,
          branchId,
          createdById: userId,
          updatedById: userId,
        },
      });
      return;
    }

    await tx.protocol.update({
      where: { id: existingProtocol.id },
      data: {
        book: protocol.book,
        page: protocol.page,
        os: protocol.os,
        updatedById: userId,
      },
    });
  }

  private async calculateCurrentSaleSubtotal(saleId: number, tx: TxClient) {
    const [productItems, serviceItems] = await Promise.all([
      tx.itemProduct.findMany({
        where: { saleId },
        select: {
          quantity: true,
          unitPrice: true,
        },
      }),
      tx.itemOpticalService.findMany({
        where: { saleId },
        select: {
          unitPrice: true,
        },
      }),
    ]);

    const productSubtotal = productItems.reduce((acc, item) => {
      return acc + item.unitPrice * item.quantity;
    }, 0);

    const serviceSubtotal = serviceItems.reduce((acc, item) => {
      return acc + item.unitPrice;
    }, 0);

    return productSubtotal + serviceSubtotal;
  }

  private async getSalePaymentState(saleId: number, tenantId: string) {
    const payment = await prisma.payment.findFirst({
      where: {
        saleId,
        tenantId,
      },
      include: {
        methods: {
          select: {
            id: true,
            isPaid: true,
            paidAt: true,
            installmentItems: {
              select: {
                paidAt: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new AppError("Pagamento não encontrado para esta venda.", 404);
    }

    const hasPaidMethod = payment.methods.some(
      (method) => method.isPaid || method.paidAt !== null,
    );

    const hasPaidInstallment = payment.methods.some((method) =>
      method.installmentItems.some((installment) => installment.paidAt !== null),
    );

    const hasPaymentActivity =
      payment.status !== "PENDING" ||
      payment.paidAmount > 0 ||
      hasPaidMethod ||
      hasPaidInstallment;

    return {
      payment,
      hasPaymentActivity,
    };
  }

  private buildComparableSaleState(
    sale: NonNullable<Awaited<ReturnType<SaleRepository["findById"]>>>,
  ): ComparableSaleState {
    return {
      clientId: sale.clientId,
      saleDate: sale.saleDate ?? null,
      prescriptionId: sale.prescriptionId ?? null,
      notes: sale.notes ?? null,
      discount: sale.discount ?? 0,
      productItems: sale.productItems
        .map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          frameDetails: item.frameDetails
            ? {
              material: item.frameDetails.material,
              reference: item.frameDetails.reference ?? null,
              color: item.frameDetails.color ?? null,
            }
            : null,
        }))
        .sort((a, b) => a.productId - b.productId),
      serviceItems: sale.serviceItems
        .map((item) => ({
          serviceId: item.serviceId,
        }))
        .sort((a, b) => a.serviceId - b.serviceId),
      protocol: sale.protocol
        ? {
          book: sale.protocol.book ?? null,
          page: sale.protocol.page ?? null,
          os: sale.protocol.os ?? null,
        }
        : null,
    };
  }

  private getChangedSaleFields(
    body: UpdateSaleDto,
    sale: NonNullable<Awaited<ReturnType<SaleRepository["findById"]>>>,
  ) {
    const comparableCurrent = this.buildComparableSaleState(sale);

    const comparableIncoming: Partial<ComparableSaleState> = {
      ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
      ...(body.saleDate !== undefined ? { saleDate: body.saleDate } : {}),
      ...(body.prescriptionId !== undefined
        ? { prescriptionId: body.prescriptionId ?? null }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes ?? null } : {}),
      ...(body.discount !== undefined ? { discount: body.discount } : {}),
      ...(body.productItems !== undefined
        ? {
          productItems: body.productItems
            .map((item) => ({
              productId: item.productId,
              quantity: item.quantity ?? 1,
              frameDetails: item.frameDetails
                ? {
                  material: item.frameDetails.material ?? null,
                  reference: item.frameDetails.reference ?? null,
                  color: item.frameDetails.color ?? null,
                }
                : null,
            }))
            .sort((a, b) => a.productId - b.productId),
        }
        : {}),
      ...(body.serviceItems !== undefined
        ? {
          serviceItems: body.serviceItems
            .map((item) => ({
              serviceId: item.serviceId,
            }))
            .sort((a, b) => a.serviceId - b.serviceId),
        }
        : {}),
      ...(body.protocol !== undefined
        ? {
          protocol: body.protocol
            ? {
              book: body.protocol.book ?? null,
              page: body.protocol.page ?? null,
              os: body.protocol.os ?? null,
            }
            : null,
        }
        : {}),
    };

    const changedComparable = getChangedFields<ComparableSaleState>(
      comparableIncoming,
      comparableCurrent,
    );

    const changedBody: Partial<UpdateSaleDto> = {};

    if ("clientId" in changedComparable) changedBody.clientId = body.clientId;
    if ("saleDate" in changedComparable) changedBody.saleDate = body.saleDate;
    if ("prescriptionId" in changedComparable) {
      changedBody.prescriptionId = body.prescriptionId;
    }
    if ("notes" in changedComparable) changedBody.notes = body.notes;
    if ("discount" in changedComparable) changedBody.discount = body.discount;
    if ("productItems" in changedComparable) {
      changedBody.productItems = body.productItems;
    }
    if ("serviceItems" in changedComparable) {
      changedBody.serviceItems = body.serviceItems;
    }
    if ("protocol" in changedComparable) changedBody.protocol = body.protocol;

    return changedBody;
  }

  private ensureEditableFieldsWhenPaymentStarted(
    sale: Awaited<ReturnType<SaleRepository["findById"]>>,
    body: UpdateSaleDto,
  ) {
    if (body.discount !== undefined) {
      throw new AppError(
        "Não é possível alterar desconto da venda quando já existem pagamentos registrados.",
        409,
      );
    }

    if (body.serviceItems !== undefined) {
      throw new AppError(
        "Não é possível alterar os serviços da venda quando já existem pagamentos registrados.",
        409,
      );
    }

    if (body.productItems === undefined) {
      return;
    }

    const currentItems = sale?.productItems ?? [];

    if (body.productItems.length !== currentItems.length) {
      throw new AppError(
        "Não é possível alterar os produtos da venda quando já existem pagamentos registrados.",
        409,
      );
    }

    const currentByProductId = new Map(
      currentItems.map((item) => [item.productId, item]),
    );

    for (const item of body.productItems) {
      const currentItem = currentByProductId.get(item.productId);

      if (!currentItem || (item.quantity ?? 1) !== currentItem.quantity) {
        throw new AppError(
          "Não é possível alterar os produtos ou quantidades da venda quando já existem pagamentos registrados.",
          409,
        );
      }
    }
  }

  private async syncFrameDetailsOnly(
    saleId: number,
    items: UpdateItemProductDto[],
    sale: NonNullable<Awaited<ReturnType<SaleRepository["findById"]>>>,
    tenantId: string,
    branchId: string,
    userId: string,
    tx: TxClient,
  ) {
    const currentItemsByProductId = new Map(
      sale.productItems.map((item) => [item.productId, item]),
    );

    for (const item of items) {
      const existingItem = currentItemsByProductId.get(item.productId);

      if (!existingItem) {
        throw new AppError("Item de produto da venda não encontrado.", 404);
      }

      if (existingItem.product.category !== "FRAME") {
        continue;
      }

      if (!item.frameDetails) {
        continue;
      }

      if (item.frameDetails.material === undefined) {
        throw new AppError(
          "O campo material é obrigatório para atualizar frameDetails.",
          400,
        );
      }

      if (existingItem.frameDetails) {
        await tx.frameDetails.update({
          where: { id: existingItem.frameDetails.id },
          data: {
            material: item.frameDetails.material,
            reference: item.frameDetails.reference,
            color: item.frameDetails.color,
            updatedById: userId,
          },
        });
        continue;
      }

      await tx.frameDetails.create({
        data: {
          itemProductId: existingItem.id,
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

  async create(req: Request) {
    const { userId, tenantId, branchId } = this.extractUser(req);
    const body = req.body as CreateSaleDto;

    const hasItems =
      (body.productItems?.length ?? 0) > 0 ||
      (body.serviceItems?.length ?? 0) > 0;

    if (!hasItems) {
      throw new AppError("É necessário pelo menos um produto ou serviço.", 400);
    }

    await this.validateClient(body.clientId, tenantId);
    this.validateSaleDate(body.saleDate);

    if (body.prescriptionId) {
      await this.validatePrescription(
        body.prescriptionId,
        body.clientId,
        tenantId,
      );
    }

    return prisma.$transaction(async (tx) => {
      const { subtotal } = await this.calculateCreateTotals(
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
        await this.createProductItems(
          sale.id,
          body.productItems,
          tenantId,
          branchId,
          userId,
          tx,
        );
      }

      if (body.serviceItems?.length) {
        await this.createServiceItems(
          sale.id,
          body.serviceItems,
          tenantId,
          branchId,
          userId,
          tx,
        );
      }

      if (body.protocol) {
        await this.upsertProtocol(
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
    const { userId, tenantId, branchId } = this.extractUser(req);
    const saleId = this.validateSaleId(req.params.id);
    const body = req.body as UpdateSaleDto;

    const sale = await this.saleRepo.findById(saleId, tenantId);

    if (!sale) {
      throw new AppError("Venda não encontrada.", 404);
    }

    const changedFields = this.getChangedSaleFields(body, sale);

    const { hasPaymentActivity } = await this.getSalePaymentState(
      saleId,
      tenantId,
    );

    if (hasPaymentActivity) {
      this.ensureEditableFieldsWhenPaymentStarted(sale, changedFields);
    }

    const nextClientId = changedFields.clientId ?? sale.clientId;

    if (changedFields.clientId) {
      await this.validateClient(changedFields.clientId, tenantId);
    }

    if (changedFields.saleDate) {
      this.validateSaleDate(changedFields.saleDate);
    }

    if (changedFields.prescriptionId) {
      await this.validatePrescription(
        changedFields.prescriptionId,
        nextClientId,
        tenantId,
      );
    }

    return prisma.$transaction(async (tx) => {
      if (changedFields.productItems !== undefined && hasPaymentActivity) {
        await this.syncFrameDetailsOnly(
          saleId,
          changedFields.productItems,
          sale,
          tenantId,
          branchId,
          userId,
          tx,
        );
      } else if (changedFields.productItems !== undefined) {
        await this.replaceProductItems(
          saleId,
          changedFields.productItems,
          tenantId,
          branchId,
          userId,
          tx,
        );
      }

      if (changedFields.serviceItems !== undefined) {
        await this.replaceServiceItems(
          saleId,
          changedFields.serviceItems,
          tenantId,
          branchId,
          userId,
          tx,
        );
      }

      if (changedFields.protocol) {
        await this.upsertProtocol(
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
        : await this.calculateCurrentSaleSubtotal(saleId, tx);
      const discount = hasPaymentActivity
        ? (sale.discount ?? 0)
        : (changedFields.discount ?? sale.discount ?? 0);
      const total = subtotal - discount;

      const normalizedSaleDate =
        changedFields.saleDate !== undefined
          ? this.normalizeSaleDateForPersistence(changedFields.saleDate, {
            saleId,
            source: "changedFields",
          })
          : this.normalizeSaleDateForPersistence(sale.saleDate, {
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
    const { tenantId } = this.extractUser(req);

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
    const { tenantId } = this.extractUser(req);
    const saleId = this.validateSaleId(req.params.id);

    const sale = await this.saleRepo.findById(saleId, tenantId);

    if (!sale) {
      throw new AppError("Venda não encontrada.", 404);
    }

    return ApiResponse.success("Venda encontrada.", req, sale);
  }

  async findByClient(req: Request) {
    const { tenantId } = this.extractUser(req);
    const clientId = this.validateSaleId(req.params.clientId);

    await this.validateClient(clientId, tenantId);

    const sales = await this.saleRepo.findByClientId(clientId, tenantId);

    return ApiResponse.success(
      "Vendas do cliente listadas com sucesso.",
      req,
      sales,
    );
  }

  async delete(req: Request) {
    const { userId, tenantId } = this.extractUser(req);
    const saleId = this.validateSaleId(req.params.id);

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
        include: {
          product: {
            select: {
              id: true,
            },
          },
        },
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
