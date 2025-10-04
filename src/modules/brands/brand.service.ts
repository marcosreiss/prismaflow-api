import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { BrandRepository } from "./brand.repository";

export class BrandService {
  private repo = new BrandRepository();

  async create(req: Request, data: any) {
    const user = req.user!;
    if (user.role !== "ADMIN") {
      return ApiResponse.error(
        "Apenas administradores podem criar marcas.",
        403,
        req
      );
    }

    const exists = await this.repo.findByNameInTenant(user.tenantId, data.name);
    if (exists) {
      return ApiResponse.error("Já existe uma marca com esse nome.", 409, req);
    }

    const brand = await this.repo.create(user.tenantId, data, user.sub);
    return ApiResponse.success("Marca criada com sucesso.", req, brand);
  }

  async update(req: Request, id: number, data: any) {
    const user = req.user!;
    if (user.role !== "ADMIN") {
      return ApiResponse.error(
        "Apenas administradores podem atualizar marcas.",
        403,
        req
      );
    }

    const brand = await this.repo.findById(id);
    if (!brand) {
      return ApiResponse.error("Marca não encontrada.", 404, req);
    }

    const updated = await this.repo.update(id, data, user.sub);
    return ApiResponse.success("Marca atualizada com sucesso.", req, updated);
  }

  async list(req: Request) {
    const user = req.user!;
    if (user.role !== "ADMIN") {
      return ApiResponse.error("Acesso negado.", 403, req);
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = (req.query.search as string) || "";

    const { items, total } = await this.repo.findAllByTenant(
      user.tenantId,
      page,
      limit,
      search
    );
    return new PagedResponse(
      "Marcas listadas com sucesso.",
      req,
      items,
      page,
      limit,
      total
    );
  }

  async getById(req: Request, id: number) {
    const user = req.user!;
    if (user.role !== "ADMIN") {
      return ApiResponse.error("Acesso negado.", 403, req);
    }

    const brand = await this.repo.findById(id);
    if (!brand) {
      return ApiResponse.error("Marca não encontrada.", 404, req);
    }

    return ApiResponse.success("Marca encontrada com sucesso.", req, brand);
  }

  async delete(req: Request, id: number) {
    const user = req.user!;
    if (user.role !== "ADMIN") {
      return ApiResponse.error(
        "Apenas administradores podem excluir marcas.",
        403,
        req
      );
    }

    const brand = await this.repo.findById(id);
    if (!brand) {
      return ApiResponse.error("Marca não encontrada.", 404, req);
    }

    await this.repo.delete(id);
    return ApiResponse.success("Marca excluída com sucesso.", req);
  }
}
