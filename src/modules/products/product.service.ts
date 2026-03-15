import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { ProductRepository } from "./product.repository";
import { ProductCategory } from "@prisma/client";

export class ProductService {
  private repo = new ProductRepository();

  async create(req: Request, data: any) {
    const user = req.user!;

    // Preenche automaticamente os campos de contexto
    data.tenantId = user.tenantId;
    data.branchId = user.branchId;

    // Validação de campos obrigatórios
    if (!data.brandId) {
      return ApiResponse.error("O campo 'brandId' é obrigatório.", 400, req);
    }

    //  Verifica duplicidade de nome + marca dentro do mesmo tenant
    const sameNameAndBrand = await this.repo.findByNameAndBrandInTenant(
      user.tenantId,
      data.name,
      data.brandId,
    );

    if (sameNameAndBrand) {
      return ApiResponse.error(
        "Já existe um produto com esse nome para essa marca.",
        409,
        req,
      );
    }

    //  Criação do produto
    const product = await this.repo.create(user.tenantId, data, user.sub);

    return ApiResponse.success("Produto criado com sucesso.", req, product);
  }

  async update(req: Request, id: number, data: any) {
    const user = req.user!;

    const product = await this.repo.findById(id);
    if (!product) {
      return ApiResponse.error("Produto não encontrado.", 404, req);
    }

    const updated = await this.repo.update(id, data, user.sub);
    return ApiResponse.success("Produto atualizado com sucesso.", req, updated);
  }

  async getById(req: Request, id: number) {
    const user = req.user!;

    const product = await this.repo.findById(id);
    if (!product || product.tenantId !== user.tenantId) {
      return ApiResponse.error("Produto não encontrado.", 404, req);
    }

    return ApiResponse.success("Produto encontrado com sucesso.", req, product);
  }

  async list(req: Request) {
    const user = req.user!;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = (req.query.search as string) || "";
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
    const user = req.user!;

    const product = await this.repo.findById(id);
    if (!product || product.tenantId !== user.tenantId) {
      return ApiResponse.error("Produto não encontrado.", 404, req);
    }

    await this.repo.delete(id);
    return ApiResponse.success("Produto excluído com sucesso.", req);
  }

  async getStock(req: Request, id: number) {
    const user = req.user!;

    const product = await this.repo.findStockById(id, user.tenantId);

    if (!product) {
      return ApiResponse.error("Produto não encontrado.", 404, req);
    }

    return ApiResponse.success("Estoque do produto obtido com sucesso.", req, {
      productId: product.id,
      stockQuantity: product.stockQuantity ?? 0,
    });
  }
}
