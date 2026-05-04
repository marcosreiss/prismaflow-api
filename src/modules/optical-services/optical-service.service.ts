// src/modules/optical-services/optical-service.service.ts
import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { OpticalServiceRepository } from "./optical-service.repository";
import { AppError } from "../../utils/app-error";
import {
  CreateOpticalServiceDto,
  UpdateOpticalServiceDto,
} from "./optical-service.dto";

export class OpticalServiceService {
  private repo = new OpticalServiceRepository();

  async create(req: Request, dto: CreateOpticalServiceDto) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    // branchId obrigatório no schema — garante antes de chegar ao Prisma
    if (!user.branchId) {
      throw new AppError("Usuário não está associado a nenhuma filial.", 403);
    }

    const exists = await this.repo.findByNameInTenant(user.tenantId, dto.name);
    if (exists) throw new AppError("Já existe um serviço com esse nome.", 409);

    const created = await this.repo.create(
      user.tenantId,
      {
        ...dto,
        branchId: user.branchId, // sempre do token, nunca do body
      },
      user.sub,
    );

    return ApiResponse.success("Serviço criado com sucesso.", req, created);
  }

  async update(req: Request, id: number, dto: UpdateOpticalServiceDto) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const existing = await this.repo.findById(id, user.tenantId);
    if (!existing) throw new AppError("Serviço não encontrado.", 404);

    // Verifica duplicidade de nome se está sendo alterado
    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.repo.findByNameInTenant(
        user.tenantId,
        dto.name,
      );
      if (conflict)
        throw new AppError("Já existe um serviço com esse nome.", 409);
    }

    const updated = await this.repo.update(id, dto, user.sub);
    return ApiResponse.success("Serviço atualizado com sucesso.", req, updated);
  }

  async getById(req: Request, id: number) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const existing = await this.repo.findById(id, user.tenantId);
    if (!existing) throw new AppError("Serviço não encontrado.", 404);

    return ApiResponse.success(
      "Serviço encontrado com sucesso.",
      req,
      existing,
    );
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
      "Serviços listados com sucesso.",
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

    const existing = await this.repo.findById(id, user.tenantId);
    if (!existing) throw new AppError("Serviço não encontrado.", 404);

    const hasRelations = await this.repo.hasItemOpticalServices(id);

    if (hasRelations) {
      await this.repo.softDelete(id, user.sub);
    } else {
      await this.repo.hardDelete(id);
    }

    return ApiResponse.success("Serviço excluído com sucesso.", req);
  }
}
