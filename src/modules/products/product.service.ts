// src/modules/products/product.service.ts
import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { ProductRepository } from "./product.repository";
import { BrandRepository } from "../brands/brand.repository";
import { AppError } from "../../utils/app-error";
import { CreateProductDto, UpdateProductDto } from "./product.dto";
import { ProductCategory } from "@prisma/client";

export class ProductService {
  private repo = new ProductRepository();
  private brands = new BrandRepository();

  async create(req: Request, dto: CreateProductDto) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    // Valida que a marca existe e pertence ao tenant
    const brand = await this.brands.findById(dto.brandId, user.tenantId);
    if (!brand) throw new AppError("Marca não encontrada.", 404);

    // Verifica duplicidade de nome + marca dentro do tenant
    const duplicate = await this.repo.findByNameAndBrandInTenant(
      user.tenantId,
      dto.name,
      dto.brandId,
    );
    if (duplicate) {
      throw new AppError(
        "Já existe um produto com esse nome para essa marca.",
        409,
      );
    }

    const product = await this.repo.create(
      user.tenantId,
      {
        ...dto,
        branchId: user.branchId ?? null, // preserva filial que cadastrou
      },
      user.sub,
    );

    return ApiResponse.success("Produto criado com sucesso.", req, product);
  }

  async update(req: Request, id: number, dto: UpdateProductDto) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const product = await this.repo.findById(id, user.tenantId);
    if (!product) throw new AppError("Produto não encontrado.", 404);

    // Se brandId está sendo alterado, valida que a nova marca existe no tenant
    if (dto.brandId && dto.brandId !== product.brandId) {
      const brand = await this.brands.findById(dto.brandId, user.tenantId);
      if (!brand) throw new AppError("Marca não encontrada.", 404);
    }

    // Verifica duplicidade de nome + marca se algum dos dois está mudando
    const newName = dto.name ?? product.name;
    const newBrandId = dto.brandId ?? product.brandId;
    const nameOrBrandChanged =
      (dto.name && dto.name !== product.name) ||
      (dto.brandId && dto.brandId !== product.brandId);

    if (nameOrBrandChanged) {
      const duplicate = await this.repo.findByNameAndBrandInTenant(
        user.tenantId,
        newName,
        newBrandId!,
      );
      if (duplicate && duplicate.id !== product.id) {
        throw new AppError(
          "Já existe um produto com esse nome para essa marca.",
          409,
        );
      }
    }

    const updated = await this.repo.update(id, dto, user.sub);
    return ApiResponse.success("Produto atualizado com sucesso.", req, updated);
  }

  async getById(req: Request, id: number) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const product = await this.repo.findById(id, user.tenantId);
    if (!product) throw new AppError("Produto não encontrado.", 404);

    return ApiResponse.success("Produto encontrado com sucesso.", req, product);
  }

  async list(req: Request) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const search = (req.query.search as string) || undefined;
    const category = (req.query.category as ProductCategory) || undefined;
    const brandId = req.query.brandId ? Number(req.query.brandId) : undefined;

    const { items, total } = await this.repo.findAllByTenant(
      user.tenantId,
      page,
      limit,
      search,
      category,
      brandId,
    );

    return new PagedResponse(
      "Produtos listados com sucesso.",
      req,
      items,
      page,
      limit,
      total,
    );
  }

  async delete(req: Request, id: number) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const product = await this.repo.findById(id, user.tenantId);
    if (!product) throw new AppError("Produto não encontrado.", 404);

    const hasRelations = await this.repo.hasItemProducts(id);

    if (hasRelations) {
      // Soft delete: produto tem histórico de vendas, preserva integridade
      await this.repo.softDelete(id, user.sub);
    } else {
      // Hard delete: produto sem relacionamentos, remoção física
      await this.repo.hardDelete(id);
    }

    return ApiResponse.success("Produto excluído com sucesso.", req);
  }

  async getStock(req: Request, id: number) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const product = await this.repo.findStockById(id, user.tenantId);
    if (!product) throw new AppError("Produto não encontrado.", 404);

    return ApiResponse.success("Estoque do produto obtido com sucesso.", req, {
      productId: product.id,
      stockQuantity: product.stockQuantity ?? 0,
    });
  }
}
