// src/modules/products/product.repository.ts
import { prisma } from "../../config/prisma";
import { withAuditData } from "../../config/prisma-context";
import { ProductCategory } from "@prisma/client";

type ProductCreateData = {
  name: string;
  description?: string;
  costPrice: number;
  markup: number;
  salePrice: number;
  stockQuantity: number;
  minimumStock: number;
  category: ProductCategory;
  brandId: number;
  branchId?: string | null;
};

type ProductUpdateData = {
  name?: string;
  description?: string;
  costPrice?: number;
  markup?: number;
  salePrice?: number;
  stockQuantity?: number;
  minimumStock?: number;
  category?: ProductCategory;
  brandId?: number;
  isActive?: boolean;
};

const productIncludes = {
  brand: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
};

export class ProductRepository {
  async create(tenantId: string, data: ProductCreateData, userId?: string) {
    return prisma.product.create({
      data: withAuditData(userId, { ...data, tenantId }),
      include: productIncludes,
    });
  }

  async update(id: number, data: ProductUpdateData, userId?: string) {
    return prisma.product.update({
      where: { id },
      data: withAuditData(userId, data, true),
      include: productIncludes,
    });
  }

  // Busca apenas ativos — usado em validações de negócio e listagens
  async findById(id: number, tenantId: string) {
    return prisma.product.findFirst({
      where: { id, tenantId, isActive: true },
      include: productIncludes,
    });
  }

  // Busca ignorando isActive — usado em relacionamentos (ex: detalhes de venda)
  async findByIdRaw(id: number, tenantId: string) {
    return prisma.product.findFirst({
      where: { id, tenantId },
      include: productIncludes,
    });
  }

  async findByNameAndBrandInTenant(
    tenantId: string,
    name: string,
    brandId: number,
  ) {
    return prisma.product.findFirst({
      where: { tenantId, name, brandId, isActive: true },
    });
  }

  async findAllByTenant(
    tenantId: string,
    page: number,
    limit: number,
    search?: string,
    category?: ProductCategory,
    brandId?: number,
  ) {
    const skip = (page - 1) * limit;
    const where = {
      tenantId,
      isActive: true,
      ...(search ? { name: { contains: search } } : {}),
      ...(category ? { category } : {}),
      ...(brandId ? { brandId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: productIncludes,
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total };
  }

  async hasItemProducts(id: number) {
    const count = await prisma.itemProduct.count({ where: { productId: id } });
    return count > 0;
  }

  async hardDelete(id: number) {
    return prisma.product.delete({ where: { id } });
  }

  async softDelete(id: number, userId?: string) {
    return prisma.product.update({
      where: { id },
      data: withAuditData(userId, { isActive: false }, true),
    });
  }

  async findStockById(id: number, tenantId: string) {
    return prisma.product.findFirst({
      where: { id, tenantId, isActive: true },
      select: { id: true, stockQuantity: true },
    });
  }
}
