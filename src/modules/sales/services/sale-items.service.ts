import { Prisma } from "@prisma/client";
import { AppError } from "@/utils/app-error";
import {
  CreateItemProductDto,
  UpdateItemProductDto,
} from "../dtos/item-product.dto";
import { TxClient, SaleRecord } from "../utils/sale.types";

type ServiceItemInput = Array<{ serviceId: number }>;
type ProtocolInput = {
  book?: string;
  page?: number;
  os?: string;
};

export class SaleItemsService {
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
    items: ServiceItemInput,
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

  async calculateCreateTotals(
    productItems: CreateItemProductDto[],
    serviceItems: ServiceItemInput,
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

  async createProductItems(
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

  async replaceProductItems(
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

  async createServiceItems(
    saleId: number,
    items: ServiceItemInput,
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

  async replaceServiceItems(
    saleId: number,
    items: ServiceItemInput,
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

  async upsertProtocol(
    saleId: number,
    protocol: ProtocolInput,
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

  async calculateCurrentSaleSubtotal(saleId: number, tx: TxClient) {
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

  async syncFrameDetailsOnly(
    saleId: number,
    items: UpdateItemProductDto[],
    sale: SaleRecord,
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
}
