import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { ProductRepository } from "./product.repository";
import { ProductCategory } from "@prisma/client";

export class ProductService {
  private repo = new ProductRepository();

  async create(req: Request, data: any) {
    const user = req.user!;

    // Validação de campos obrigatórios (garantia extra além do DTO)
    if (!data.brandId || !data.branchId) {
      return ApiResponse.error(
        "Os campos 'brandId' e 'branchId' são obrigatórios.",
        400,
        req
      );
    }

    const exists = await this.repo.findByNameInTenant(user.tenantId, data.name);
    if (exists) {
      return ApiResponse.error("Já existe um produto com esse nome.", 409, req);
    }

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

    const { items, total } = await this.repo.findAllByTenant(
      user.tenantId,
      page,
      limit,
      search,
      category
    );

    return new PagedResponse(
      "Produtos listados com sucesso.",
      req,
      items,
      page,
      limit,
      total
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
}
