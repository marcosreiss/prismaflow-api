import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { OpticalServiceRepository } from "./optical-service.repository";

export class OpticalServiceService {
  private repo = new OpticalServiceRepository();

  async create(req: Request, data: any) {
    const user = req.user!;

    // 🔸 Garante que o usuário tenha um branchId associado
    if (!user.branchId) {
      return ApiResponse.error(
        "Usuário não está associado a nenhuma filial (branchId).",
        400,
        req
      );
    }

    // 🔸 Força o uso do branchId do token, ignorando qualquer valor vindo do body
    data.branchId = user.branchId;

    const exists = await this.repo.findByNameInTenant(user.tenantId, data.name);
    if (exists) {
      return ApiResponse.error("Já existe um serviço com esse nome.", 409, req);
    }

    const service = await this.repo.create(user.tenantId, data, user.sub);
    return ApiResponse.success("Serviço criado com sucesso.", req, service);
  }

  async update(req: Request, id: number, data: any) {
    const user = req.user!;
    const service = await this.repo.findById(id);

    if (!service) {
      return ApiResponse.error("Serviço não encontrado.", 404, req);
    }

    // 🔒 Garante que só atualize dentro do mesmo tenant
    if (service.tenantId !== user.tenantId) {
      return ApiResponse.error("Acesso negado a este serviço.", 403, req);
    }

    const updated = await this.repo.update(id, data, user.sub);
    return ApiResponse.success("Serviço atualizado com sucesso.", req, updated);
  }

  async getById(req: Request, id: number) {
    const user = req.user!;
    const service = await this.repo.findById(id);

    if (!service || service.tenantId !== user.tenantId) {
      return ApiResponse.error("Serviço não encontrado.", 404, req);
    }

    return ApiResponse.success("Serviço encontrado com sucesso.", req, service);
  }

  async list(req: Request) {
    const user = req.user!;
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
      "Serviços listados com sucesso.",
      req,
      items,
      page,
      limit,
      total
    );
  }

  async delete(req: Request, id: number) {
    const user = req.user!;
    const service = await this.repo.findById(id);

    if (!service || service.tenantId !== user.tenantId) {
      return ApiResponse.error("Serviço não encontrado.", 404, req);
    }

    await this.repo.delete(id);
    return ApiResponse.success("Serviço excluído com sucesso.", req);
  }
}
