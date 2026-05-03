// src/modules/brands/brand.service.ts
import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { BrandRepository } from "./brand.repository";
import { AppError } from "../../utils/app-error";
import { CreateBrandDto, UpdateBrandDto } from "./brand.dto";

export class BrandService {
  private repo = new BrandRepository();

  async create(req: Request, dto: CreateBrandDto) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const exists = await this.repo.findByNameInTenant(user.tenantId, dto.name);
    if (exists) throw new AppError("Já existe uma marca com esse nome.", 409);

    const brand = await this.repo.create(user.tenantId, dto, user.sub);
    return ApiResponse.success("Marca criada com sucesso.", req, brand);
  }

  async update(req: Request, id: number, dto: UpdateBrandDto) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const brand = await this.repo.findById(id, user.tenantId);
    if (!brand) throw new AppError("Marca não encontrada.", 404);

    // Verifica duplicidade de nome apenas se o nome está sendo alterado
    if (dto.name && dto.name !== brand.name) {
      const nameConflict = await this.repo.findByNameInTenant(
        user.tenantId,
        dto.name,
      );
      if (nameConflict)
        throw new AppError("Já existe uma marca com esse nome.", 409);
    }

    const updated = await this.repo.update(id, dto, user.sub);
    return ApiResponse.success("Marca atualizada com sucesso.", req, updated);
  }

  async list(req: Request) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const search = (req.query.search as string) || undefined;

    const { items, total } = await this.repo.findAllByTenant(
      user.tenantId,
      page,
      limit,
      search,
    );

    return new PagedResponse(
      "Marcas listadas com sucesso.",
      req,
      items,
      page,
      limit,
      total,
    );
  }

  async getById(req: Request, id: number) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const brand = await this.repo.findById(id, user.tenantId);
    if (!brand) throw new AppError("Marca não encontrada.", 404);

    return ApiResponse.success("Marca encontrada com sucesso.", req, brand);
  }

  async delete(req: Request, id: number) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const brand = await this.repo.findById(id, user.tenantId);
    if (!brand) throw new AppError("Marca não encontrada.", 404);

    const linked = await this.repo.hasProducts(id);
    if (linked) {
      throw new AppError(
        "Não é possível excluir uma marca com produtos vinculados.",
        409,
      );
    }

    await this.repo.delete(id);
    return ApiResponse.success("Marca excluída com sucesso.", req);
  }
}
